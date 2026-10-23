// Acceptance tests for docs/tasks/003.2-plaintext-password-storage-on-reset.md
// (CODE_REVIEW Finding 3 -- plaintext password storage on reset).
//
// Run: node --test test/003.2-plaintext-password-storage-on-reset.test.js
//
// These tests exercise the real reset route (registered with a fake Express
// app) against stubbed Sequelize models, so the whole request contract is
// covered:
//
//   POST /reset-password/:token
//     -> { password, password2 }        (password3 is ignored)
//     -> PasswordResetService.setNewPassword
//     -> bcrypt cost 12
//     -> users_accounts.update({ password: <hash> }, { where: { uuid }, silent: true })
//     -> 'reset password successfully'
//
// Unit-level hashing/validation cases live in test/password-reset.test.js and
// are not duplicated here; this file proves the task's acceptance criteria and
// the route wiring.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcrypt');

require('dotenv').config();

const db = require('../app/db_models');
const legacyDb = require('../app/models/db.js');
const registerResetRoutes = require('../app/routes/forgot-password.js');

const UUID = 'aaaa1111-bbbb-cccc-dddd-eeee3333ffff';
const TOKEN = 'task-003-2-reset-token';
const EMAIL = 'task0032@example.com';
const PASSWORD = 'ResetMe123!';
const LEGACY_HASH = '$2b$10$fakehashfakehashfakehashfakehashfakehashfakehashfake';
const SUCCESS = 'reset password successfully';
const FAILURE = 'reset password failed';

// Captured from the registered route, so each test can invoke the real handler.
let postHandler;
const updates = [];
const tokenLookups = [];

const originals = {
    resetTokensFindOne: db.reset_tokens.findOne,
    resetTokensDestroy: db.reset_tokens.destroy,
    usersAccountsFindOne: db.users_accounts.findOne,
    usersAccountsUpdate: db.users_accounts.update,
    consoleError: console.error,
};

function captureRoute(app, method, paths, handler) {
    const registered = [].concat(paths);
    if (registered.includes('/reset-password/:token') && method === 'post') {
        postHandler = handler;
    }
}

before(() => {
    db.reset_tokens.findOne = async (options) => {
        tokenLookups.push(options);
        // Expiry is enforced by the route (Finding 49); this hashing-focused
        // suite uses a token that is valid for the whole test run.
        return { token: TOKEN, uuid: UUID, expiration: new Date(Date.now() + 60 * 60 * 1000) };
    };

    db.reset_tokens.destroy = async () => [1];

    db.users_accounts.findOne = async (options) => {
        assert.deepStrictEqual(options.where, { uuid: UUID });
        return { uuid: UUID, email_or_social_media: EMAIL };
    };

    db.users_accounts.update = async (...args) => {
        updates.push(args);
        return [1];
    };

    const app = {
        use: () => {},
        get: (paths, handler) => captureRoute(app, 'get', paths, handler),
        post: (paths, handler) => captureRoute(app, 'post', paths, handler),
    };

    registerResetRoutes(app);
    assert.strictEqual(typeof postHandler, 'function', 'POST /reset-password/:token must be registered');
});

after(async () => {
    db.reset_tokens.findOne = originals.resetTokensFindOne;
    db.reset_tokens.destroy = originals.resetTokensDestroy;
    db.users_accounts.findOne = originals.usersAccountsFindOne;
    db.users_accounts.update = originals.usersAccountsUpdate;
    console.error = originals.consoleError;

    // The route module pulls in the legacy mysql2 pool, which opens sockets on
    // import. Close it so the test process can exit.
    await new Promise((resolve) => legacyDb.end(resolve));
});

// Invoke the captured Express handler with a fake request/response pair.
function submit(body) {
    return new Promise((resolve, reject) => {
        const req = { params: { token: TOKEN }, body };
        const res = { send: (value) => resolve(value) };

        Promise.resolve(postHandler(req, res)).catch(reject);
    });
}

function resetSpies() {
    updates.length = 0;
    tokenLookups.length = 0;
}

// --- Request contract ------------------------------------------------------

test('a plaintext password is hashed with bcrypt cost 12 before it is stored', async () => {
    resetSpies();

    const response = await submit({ password: PASSWORD, password2: PASSWORD });

    assert.strictEqual(response, SUCCESS);
    assert.strictEqual(tokenLookups.length, 1, 'the token is looked up');
    assert.deepStrictEqual(tokenLookups[0].where, { token: TOKEN });
    assert.strictEqual(updates.length, 1, 'exactly one password update');

    const [values, options] = updates[0];
    assert.deepStrictEqual(Object.keys(values), ['password'], 'only the password column is written');
    assert.notStrictEqual(values.password, PASSWORD, 'plaintext never reaches the database');
    assert.match(values.password, /^\$2[aby]\$12\$/);
    assert.strictEqual(await bcrypt.compare(PASSWORD, values.password), true);
    assert.deepStrictEqual(options, { where: { uuid: UUID }, silent: true });
});

test('the legacy password3 field is ignored, including by an old cached client', async () => {
    resetSpies();

    const response = await submit({
        password: PASSWORD,
        password2: PASSWORD,
        password3: LEGACY_HASH,
    });

    assert.strictEqual(response, SUCCESS);
    assert.strictEqual(updates.length, 1);

    const stored = updates[0][0].password;
    assert.strictEqual(await bcrypt.compare(PASSWORD, stored), true, 'password is hashed');
    assert.strictEqual(await bcrypt.compare(LEGACY_HASH, stored), false, 'password3 is not double-hashed');
    assert.notStrictEqual(stored, LEGACY_HASH);
});

test('a password3-only POST cannot write that value', async () => {
    resetSpies();

    const plaintextOnly = await submit({ password3: 'PlainText123!' });
    const hashOnly = await submit({ password3: LEGACY_HASH });

    assert.strictEqual(plaintextOnly, FAILURE);
    assert.strictEqual(hashOnly, FAILURE);
    assert.strictEqual(updates.length, 0, 'nothing is written without the password field');
});

test('the visible password field is preferred over password3 (no double hash)', async () => {
    resetSpies();

    const response = await submit({
        password: 'VisiblePass1!',
        password2: 'VisiblePass1!',
        password3: LEGACY_HASH,
    });

    assert.strictEqual(response, SUCCESS);
    assert.strictEqual(updates.length, 1);

    const stored = updates[0][0].password;
    assert.strictEqual(await bcrypt.compare('VisiblePass1!', stored), true);
    assert.strictEqual(await bcrypt.compare(LEGACY_HASH, stored), false);
});

// --- Server-side validation ------------------------------------------------

test('a confirmation mismatch is rejected without writing', async () => {
    resetSpies();

    const response = await submit({ password: PASSWORD, password2: 'different' });

    assert.strictEqual(response, FAILURE);
    assert.strictEqual(updates.length, 0);
});

test('empty and missing passwords are rejected without writing', async () => {
    resetSpies();

    assert.strictEqual(await submit({ password: '', password2: '' }), FAILURE);
    assert.strictEqual(await submit({ password2: PASSWORD }), FAILURE);
    assert.strictEqual(updates.length, 0);
});

test('passwords over bcrypt 72-byte limit are rejected without writing', async () => {
    resetSpies();

    assert.strictEqual(await submit({ password: 'a'.repeat(73), password2: 'a'.repeat(73) }), FAILURE);
    assert.strictEqual(await submit({ password: '€'.repeat(25), password2: '€'.repeat(25) }), FAILURE);
    assert.strictEqual(updates.length, 0);
});

test('a 72-byte password is accepted', async () => {
    resetSpies();

    const password = 'a'.repeat(72);
    const response = await submit({ password, password2: password });

    assert.strictEqual(response, SUCCESS);
    assert.strictEqual(updates.length, 1);
    assert.strictEqual(await bcrypt.compare(password, updates[0][0].password), true);
});

// --- Security properties ---------------------------------------------------

test('each reset uses a unique salt', async () => {
    resetSpies();

    await submit({ password: PASSWORD, password2: PASSWORD });
    await submit({ password: PASSWORD, password2: PASSWORD });

    assert.strictEqual(updates.length, 2);
    const [first, second] = updates.map(([values]) => values.password);

    assert.notStrictEqual(first, second, 'identical passwords must not produce identical hashes');
    assert.strictEqual(await bcrypt.compare(PASSWORD, first), true);
    assert.strictEqual(await bcrypt.compare(PASSWORD, second), true);
});

test('SQL-shaped passwords are hashed as data', async () => {
    resetSpies();

    const password = "' OR 1=1 --";
    const response = await submit({ password, password2: password });

    assert.strictEqual(response, SUCCESS);
    assert.match(updates[0][0].password, /^\$2[aby]\$12\$/);
    assert.strictEqual(await bcrypt.compare(password, updates[0][0].password), true);
});

test('failures return a generic message and never log or return the password', async () => {
    resetSpies();

    const logs = [];
    console.error = (...args) => logs.push(args.join(' '));

    const response = await submit({ password: '', password2: '' });

    assert.strictEqual(response, FAILURE);
    assert.ok(!response.includes(PASSWORD));
    assert.ok(!logs.join(' ').includes(PASSWORD), 'the plaintext is never logged');
    assert.strictEqual(updates.length, 0);
});
