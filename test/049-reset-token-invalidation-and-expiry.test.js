// Acceptance + regression tests for
// docs/tasks/049-Reset-Tokens-Not-Invalidated-After-Use-and-Missing-Expiry-Enforcement.md
// (CODE_REVIEW Finding 49, duplicate Finding 23 -- reusable / unexpired reset tokens).
//
// Run: node --test test/049-reset-token-invalidation-and-expiry.test.js
//
// The real GET and POST handlers are captured from the route module with a
// fake Express app and exercised against stubbed Sequelize models. No database
// or SMTP connection is made.
//
//   GET  /reset-password/:token  -> 404 generic message for invalid/expired tokens
//   POST /reset-password/:token  -> 'reset password failed' (HTTP 200), no update
//   POST valid token             -> update, then destroy({ where: { token } }), success
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert');

require('dotenv').config();

// The route module imports the legacy mysql2 pool, which opens sockets and
// installs a reconnect timer. Stub it before requiring the route so this test
// stays offline and the process can exit.
const dbModulePath = require.resolve('../app/models/db.js');
const fakeLegacyDb = {
    query: null,
    end: (callback) => {
        if (callback) callback();
    },
};
require.cache[dbModulePath] = {
    id: dbModulePath,
    filename: dbModulePath,
    loaded: true,
    exports: fakeLegacyDb,
};

const db = require('../app/db_models');
const registerResetRoutes = require('../app/routes/forgot-password.js');

const TOKEN = 'task-049-reset-token';
const UUID = 'aaaa1111-bbbb-cccc-dddd-eeee4949ffff';
const EMAIL = 'task049@example.com';
const PASSWORD = 'ResetMe123!';
const SUCCESS = 'reset password successfully';
const FAILURE = 'reset password failed';
const INVALID_TOKEN = 'Invalid or expired reset token';
const HOUR_MS = 60 * 60 * 1000;

let getHandler;
let postHandler;

const state = {
    tokenRow: null,
    account: null,
    tokenLookups: [],
    accountLookups: [],
    updates: [],
    destroys: [],
    writes: [],
};

function resetState() {
    state.tokenRow = {
        token: TOKEN,
        uuid: UUID,
        expiration: new Date(Date.now() + HOUR_MS),
    };
    state.account = { uuid: UUID, email_or_social_media: EMAIL };
    state.tokenLookups.length = 0;
    state.accountLookups.length = 0;
    state.updates.length = 0;
    state.destroys.length = 0;
    state.writes.length = 0;
}

const originals = {
    resetTokensFindOne: db.reset_tokens.findOne,
    resetTokensDestroy: db.reset_tokens.destroy,
    usersAccountsFindOne: db.users_accounts.findOne,
    usersAccountsUpdate: db.users_accounts.update,
};

const resetTokensDestroyStub = async (options) => {
    state.destroys.push(options);
    state.writes.push('destroy');
    // Mirror a real delete: a reused token no longer exists.
    state.tokenRow = null;
    return 1;
};

function captureRoute(app, method, paths, handler) {
    const registered = [].concat(paths);
    if (!registered.includes('/reset-password/:token')) return;

    if (method === 'get') getHandler = handler;
    if (method === 'post') postHandler = handler;
}

before(() => {
    db.reset_tokens.findOne = async (options) => {
        state.tokenLookups.push(options);
        return state.tokenRow;
    };

    db.reset_tokens.destroy = resetTokensDestroyStub;

    db.users_accounts.findOne = async (options) => {
        state.accountLookups.push(options);
        return state.account;
    };

    db.users_accounts.update = async (...args) => {
        state.updates.push(args);
        state.writes.push('update');
        return [1];
    };

    const app = {
        use: () => {},
        get: (paths, ...handlers) => captureRoute(app, 'get', paths, handlers[handlers.length - 1]),
        post: (paths, ...handlers) => captureRoute(app, 'post', paths, handlers[handlers.length - 1]),
    };

    registerResetRoutes(app);

    assert.strictEqual(typeof getHandler, 'function', 'GET /reset-password/:token must be registered');
    assert.strictEqual(typeof postHandler, 'function', 'POST /reset-password/:token must be registered');
});

beforeEach(() => {
    resetState();
});

after(() => {
    db.reset_tokens.findOne = originals.resetTokensFindOne;
    db.reset_tokens.destroy = originals.resetTokensDestroy;
    db.users_accounts.findOne = originals.usersAccountsFindOne;
    db.users_accounts.update = originals.usersAccountsUpdate;
});

function invoke(handler, { token = TOKEN, body = {} } = {}) {
    return new Promise((resolve, reject) => {
        const req = { params: { token }, body };
        const res = {
            statusCode: 200,
            status(code) {
                this.statusCode = code;
                return this;
            },
            send(payload) {
                resolve({ kind: 'send', statusCode: this.statusCode, body: payload });
            },
            render(view, locals) {
                resolve({ kind: 'render', statusCode: this.statusCode, view, locals });
            },
        };

        Promise.resolve(handler(req, res)).catch(reject);
    });
}

const get = (token = TOKEN) => invoke(getHandler, { token });
const post = (token = TOKEN, body = { password: PASSWORD, password2: PASSWORD }) =>
    invoke(postHandler, { token, body });

function assertNothingWritten() {
    assert.strictEqual(state.updates.length, 0, 'no password update');
    assert.strictEqual(state.destroys.length, 0, 'no token deletion');
}

// --- Valid tokens ----------------------------------------------------------

test('GET renders the reset form with the account email for a valid token', async () => {
    const result = await get();

    assert.strictEqual(result.kind, 'render');
    assert.strictEqual(result.locals.email, EMAIL);
    assert.match(result.view, /reset-password[\\/]index$/);
    assert.deepStrictEqual(state.tokenLookups[0].where, { token: TOKEN });
    assert.deepStrictEqual(state.accountLookups[0].where, { uuid: UUID });
    assertNothingWritten();
});

test('POST updates the password, deletes exactly the used token, then succeeds', async () => {
    const result = await post(TOKEN, { password: PASSWORD, password2: PASSWORD });

    assert.deepStrictEqual(result, { kind: 'send', statusCode: 200, body: SUCCESS });
    assert.strictEqual(state.updates.length, 1, 'exactly one password update');
    assert.deepStrictEqual(state.updates[0][1], { where: { uuid: UUID }, silent: true });
    assert.deepStrictEqual(state.destroys, [{ where: { token: TOKEN } }], 'only the used token is deleted');
    assert.deepStrictEqual(state.writes, ['update', 'destroy'], 'the token is deleted after the update');
});

// --- Missing / malformed tokens -------------------------------------------

test('GET rejects a missing token with a generic 404 and does not look up the account', async () => {
    state.tokenRow = null;

    const result = await get('does-not-exist');

    assert.deepStrictEqual(result, { kind: 'send', statusCode: 404, body: INVALID_TOKEN });
    assert.strictEqual(state.accountLookups.length, 0);
    assertNothingWritten();
});

test('POST rejects a missing token with the legacy failure string and writes nothing', async () => {
    state.tokenRow = null;

    const result = await post('does-not-exist');

    assert.deepStrictEqual(result, { kind: 'send', statusCode: 200, body: FAILURE });
    assert.strictEqual(state.accountLookups.length, 0);
    assertNothingWritten();
});

test('an empty token is rejected before any database lookup', async () => {
    assert.strictEqual((await get('')).kind, 'send');
    assert.strictEqual((await post('')).body, FAILURE);
    assert.strictEqual(state.tokenLookups.length, 0, 'empty tokens never reach Sequelize');
    assertNothingWritten();
});

test('a token row without a matching account fails safely and is not deleted', async () => {
    state.account = null;

    const getResult = await get();
    const postResult = await post();

    assert.strictEqual(getResult.statusCode, 404);
    assert.strictEqual(postResult.body, FAILURE);
    assertNothingWritten();
});

test('very long and SQL-shaped tokens are passed as bound Sequelize values', async () => {
    const tokens = ['a'.repeat(10000), "' OR '1'='1", '" OR 1=1 --', '%_\\', 'tökén-🦄'];

    for (const token of tokens) {
        state.tokenRow = null;
        const result = await post(token);

        assert.strictEqual(result.body, FAILURE);
        assert.deepStrictEqual(state.tokenLookups.at(-1).where, { token });
    }

    assertNothingWritten();
});

// --- Expiry ----------------------------------------------------------------

test('GET rejects an expired token without looking up the account', async () => {
    state.tokenRow.expiration = new Date(Date.now() - HOUR_MS);

    const result = await get();

    assert.deepStrictEqual(result, { kind: 'send', statusCode: 404, body: INVALID_TOKEN });
    assert.strictEqual(state.accountLookups.length, 0);
    assertNothingWritten();
});

test('POST rejects an expired token without updating or deleting anything', async () => {
    state.tokenRow.expiration = new Date(Date.now() - HOUR_MS);

    const result = await post();

    assert.deepStrictEqual(result, { kind: 'send', statusCode: 200, body: FAILURE });
    assert.strictEqual(state.accountLookups.length, 0);
    assertNothingWritten();
});

test('an expiration at or before now is treated as expired', async () => {
    state.tokenRow.expiration = new Date(Date.now());

    assert.strictEqual((await get()).statusCode, 404);
    assert.strictEqual((await post()).body, FAILURE);
    assertNothingWritten();
});

test('null, empty, and unparseable expirations fail closed', async () => {
    for (const expiration of [null, '', 'not-a-date', undefined]) {
        resetState();
        state.tokenRow.expiration = expiration;

        assert.strictEqual((await get()).statusCode, 404, `GET rejects ${String(expiration)}`);
        assert.strictEqual((await post()).body, FAILURE, `POST rejects ${String(expiration)}`);
        assertNothingWritten();
    }
});

test('a token with a comfortable future expiration is accepted', async () => {
    state.tokenRow.expiration = new Date(Date.now() + 60 * 1000);

    assert.strictEqual((await get()).kind, 'render');
    assert.strictEqual((await post()).body, SUCCESS);
    assert.strictEqual(state.destroys.length, 1);
});

// --- Single-use behavior ---------------------------------------------------

test('a reused token cannot reset the password a second time', async () => {
    const first = await post();
    const second = await post();

    assert.strictEqual(first.body, SUCCESS);
    assert.strictEqual(second.body, FAILURE);
    assert.strictEqual(state.updates.length, 1, 'the password is updated only once');
    assert.strictEqual(state.destroys.length, 1, 'the token is deleted only once');
});

test('a reused token cannot render the reset form after a successful reset', async () => {
    await post();

    const result = await get();

    assert.deepStrictEqual(result, { kind: 'send', statusCode: 404, body: INVALID_TOKEN });
});

test('GET does not delete the token', async () => {
    await get();

    assert.strictEqual(state.destroys.length, 0);
    assert.strictEqual(state.tokenRow !== null, true);
});

// --- Failure paths keep the token -----------------------------------------

test('a password validation failure does not delete the token', async () => {
    const result = await post(TOKEN, { password: PASSWORD, password2: 'different' });

    assert.strictEqual(result.body, FAILURE);
    assertNothingWritten();
});

test('missing password fields keep the valid token for a retry', async () => {
    const result = await post(TOKEN, {});

    assert.deepStrictEqual(result, { kind: 'send', statusCode: 200, body: FAILURE });
    assertNothingWritten();
    assert.strictEqual(state.tokenRow !== null, true, 'the token is retained after validation failure');
});

test('a token deletion failure does not report success', async () => {
    db.reset_tokens.destroy = async () => {
        throw new Error('delete failed');
    };

    const logs = [];
    const originalError = console.error;
    console.error = (...args) => logs.push(args.join(' '));

    try {
        const result = await post();

        assert.strictEqual(result.body, FAILURE);
        assert.strictEqual(state.updates.length, 1, 'the password may already have changed');
        assert.ok(logs.join(' ').includes('delete failed'), 'the deletion failure is logged');
    } finally {
        console.error = originalError;
        db.reset_tokens.destroy = resetTokensDestroyStub;
    }
});
