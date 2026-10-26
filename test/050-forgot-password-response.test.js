// Acceptance + regression tests for docs/tasks/050-Forgot-Password-Flow-Exposes-Password-Hash-in-Response.md
// (CODE_REVIEW Finding 50 -- forgot-password lookup returned the stored password/hash).
//
// Run: node --test test/050-forgot-password-response.test.js
//
// These tests exercise the real controller + model against a stubbed legacy
// mysql2 pool, so the whole request contract is covered without a live database:
//
//   POST /api/post/forgot-password-process
//     -> controller.create
//     -> model.create
//     -> USERS_ACCOUNTS.GET_BY_EMAIL (parameterized)
//     -> { message, email_or_social_media, uuid }   (never password)
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config();

// Replace the legacy mysql2 pool before the model imports it. The real module
// opens sockets and installs a reconnect timer, which would keep this test
// process alive; a require.cache stub keeps the test fully offline.
const dbModulePath = require.resolve('../app/models/db.js');
const fakeDb = {
    query: null,
    end: (callback) => {
        if (callback) callback();
    },
};
require.cache[dbModulePath] = {
    id: dbModulePath,
    filename: dbModulePath,
    loaded: true,
    exports: fakeDb,
};

const Model = require('../app/models/forgot-password.model.js');
const controller = require('../app/controllers/forgot-password.controller.js');
const USERS_ACCOUNTS = require('../app/query/users_accounts.query.js');

// Register the real forgot-password route module against a capture-only app so
// the downstream create-reset-token handler can be exercised without HTTP or
// SMTP. It reuses the same stubbed legacy pool from require.cache above.
let createResetTokenHandler;
const captureApp = {
    use: () => {},
    get: () => {},
    post: (paths, ...handlers) => {
        if ([].concat(paths).includes('/api/post/create-reset-token')) {
            createResetTokenHandler = handlers[handlers.length - 1];
        }
    },
};
require('../app/routes/forgot-password.js')(captureApp);

const CONTROLLER_PATH = path.join(__dirname, '..', 'app', 'controllers', 'forgot-password.controller.js');
const MODEL_PATH = path.join(__dirname, '..', 'app', 'models', 'forgot-password.model.js');

const EMAIL = 'task050@example.com';
const UUID = 'aaaa1111-bbbb-cccc-dddd-eeee5050ffff';
const STORED_HASH = '$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake';
const STORED_PLAINTEXT = 'LegacyPlainText123!';
const SQL_SHAPED = "' OR '1'='1";

// Invoke the real controller with a fake Express request/response pair.
function submit(body, session = {}) {
    return new Promise((resolve, reject) => {
        const req = { body, session };
        const res = {
            statusCode: 200,
            status(code) {
                this.statusCode = code;
                return this;
            },
            send(payload) {
                resolve({ statusCode: this.statusCode, body: payload, session: req.session });
            },
        };

        try {
            controller.create(req, res);
        } catch (error) {
            reject(error);
        }
    });
}

function stubQuery(rows, onCall) {
    fakeDb.query = (sql, params, callback) => {
        if (onCall) onCall(sql, params);
        callback(null, rows);
    };
}

function assertNoCredentialMaterial(result) {
    assert.strictEqual(result.body.password, undefined, 'no password key');
    assert.strictEqual(result.body.password_hash, undefined, 'no password_hash key');
    assert.strictEqual(result.body.hashed_password, undefined, 'no hashed_password key');
    assert.strictEqual(result.body.row, undefined, 'no raw row key');

    const serialized = JSON.stringify(result.body);
    assert.ok(!serialized.includes(STORED_HASH), 'the stored bcrypt hash is absent');
    assert.ok(!serialized.includes(STORED_PLAINTEXT), 'the legacy plaintext is absent');
}

// --- Positive cases --------------------------------------------------------

test('found account returns only message, email_or_social_media, and uuid', async () => {
    stubQuery([{ email_or_social_media: EMAIL, password: STORED_HASH, uuid: UUID }]);

    const result = await submit({ emailAddress: EMAIL });

    assert.strictEqual(result.statusCode, 200);
    assert.deepStrictEqual(result.body, {
        message: 'found',
        email_or_social_media: EMAIL,
        uuid: UUID,
    });
    assertNoCredentialMaterial(result);
});

test('found response never serializes the stored hash even if the row carries it', async () => {
    stubQuery([{ email_or_social_media: EMAIL, password: STORED_HASH, uuid: UUID }]);

    const result = await submit({ emailAddress: EMAIL });

    assert.ok(!JSON.stringify(result.body).includes(STORED_HASH));
    assert.ok(!JSON.stringify(result.body).includes('$2b$'));
});

test('a legacy plaintext password row is not exposed', async () => {
    stubQuery([{ email_or_social_media: EMAIL, password: STORED_PLAINTEXT, uuid: UUID }]);

    const result = await submit({ emailAddress: EMAIL });

    assert.strictEqual(result.body.message, 'found');
    assertNoCredentialMaterial(result);
});

test('unexpected extra row columns are not forwarded to the client', async () => {
    stubQuery([
        {
            id: 42,
            email_or_social_media: EMAIL,
            password: STORED_HASH,
            verification_code: '123456',
            status: 1,
            uuid: UUID,
        },
    ]);

    const result = await submit({ emailAddress: EMAIL });

    assert.deepStrictEqual(Object.keys(result.body).sort(), ['email_or_social_media', 'message', 'uuid']);
    assert.strictEqual(result.body.id, undefined);
    assert.strictEqual(result.body.verification_code, undefined);
    assert.strictEqual(result.body.status, undefined);
});

test('the session does not receive a forgotPassword copy of the account row', async () => {
    stubQuery([{ email_or_social_media: EMAIL, password: STORED_HASH, uuid: UUID }]);
    const session = { existing: 'kept' };

    const result = await submit({ emailAddress: EMAIL }, session);

    assert.strictEqual(result.session.forgotPassword, undefined);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(result.session, 'forgotPassword'), false);
    assert.strictEqual(result.session.existing, 'kept', 'the existing session is not disturbed');
    assert.ok(!JSON.stringify(result.session).includes(STORED_HASH));
});

test('the found response still feeds create-reset-token with uuid + email only', async () => {
    // Step 1: the forgot-password lookup.
    stubQuery([{ email_or_social_media: EMAIL, password: STORED_HASH, uuid: UUID }]);
    const lookup = await submit({ emailAddress: EMAIL });
    assert.strictEqual(lookup.body.message, 'found');

    // Step 2: the client contract -- res.email_or_social_media + res.uuid.
    let insertValues;
    fakeDb.query = (sql, values, callback) => {
        insertValues = values;
        callback(null, { insertId: 1 });
    };

    const tokenResponse = await new Promise((resolve, reject) => {
        const req = {
            body: {
                uuid: lookup.body.uuid,
                email_or_social_media: lookup.body.email_or_social_media,
            },
        };
        const res = { send: resolve };

        Promise.resolve(createResetTokenHandler(req, res)).catch(reject);
    });

    assert.strictEqual(tokenResponse.message, 'reset tokens saved');
    assert.strictEqual(tokenResponse.uuid, UUID);
    assert.strictEqual(tokenResponse.receiverEmailAddress, EMAIL);
    assert.match(tokenResponse.link, /reset-password\//);
    assert.strictEqual(tokenResponse.password, undefined);
    assert.ok(!JSON.stringify(tokenResponse).includes(STORED_HASH));
    assert.strictEqual(insertValues.length, 5, 'token, expiration, uuid, createdAt, updatedAt');
    assert.ok(!JSON.stringify(insertValues).includes(STORED_HASH));
});

// --- Negative cases --------------------------------------------------------

test('unknown email still returns the exact not-found contract', async () => {
    stubQuery([]);

    const result = await submit({ emailAddress: 'nobody@example.com' });

    assert.strictEqual(result.statusCode, 200);
    assert.deepStrictEqual(result.body, { message: 'not found' });
});

test('a database error keeps the existing not-found behavior', async () => {
    fakeDb.query = (sql, params, callback) => callback(new Error('connection lost'));

    const result = await submit({ emailAddress: EMAIL });

    assert.strictEqual(result.statusCode, 200);
    assert.deepStrictEqual(result.body, { message: 'not found' });
    assertNoCredentialMaterial(result);
});

test('a missing body still returns 400 with the original message and no credentials', async () => {
    const result = await submit(undefined);

    assert.strictEqual(result.statusCode, 400);
    assert.deepStrictEqual(result.body, { message: 'Content can not be empty!' });
});

test('a missing emailAddress is passed as an undefined bound value and returns not found', async () => {
    let capturedParams;
    stubQuery([], (sql, params) => {
        capturedParams = params;
    });

    const result = await submit({});

    assert.deepStrictEqual(capturedParams, [undefined]);
    assert.deepStrictEqual(result.body, { message: 'not found' });
});

test('a controller/model error still produces the existing 500 path', async () => {
    const originalCreate = Model.create;
    Model.create = (input, callback) => callback(new Error('model exploded'));

    try {
        const result = await submit({ emailAddress: EMAIL });
        assert.strictEqual(result.statusCode, 500);
        assert.deepStrictEqual(result.body, { message: 'model exploded' });
        assertNoCredentialMaterial(result);
    } finally {
        Model.create = originalCreate;
    }
});

// --- Boundary cases --------------------------------------------------------

test('empty, very long, and Unicode email values are bound as data and never expose credentials', async () => {
    const inputs = ['', 'a'.repeat(5000) + '@example.com', 'user+üñîçødé@example.com', 'user%_@example.com'];

    for (const input of inputs) {
        let capturedParams;
        stubQuery([{ email_or_social_media: input, password: STORED_HASH, uuid: UUID }], (sql, params) => {
            capturedParams = params;
        });

        const result = await submit({ emailAddress: input });

        assert.deepStrictEqual(capturedParams, [input], 'input is bound, not interpolated');
        assert.strictEqual(result.body.message, 'found');
        assertNoCredentialMaterial(result);
    }
});

test('SQL-shaped email input remains a bound parameter and leaks no password', async () => {
    const inputs = [SQL_SHAPED, '" OR "1"="1', "'; DROP TABLE users_accounts; --", "\\' OR 1=1 --"];

    for (const input of inputs) {
        let capturedSql;
        let capturedParams;
        stubQuery([{ email_or_social_media: input, password: STORED_HASH, uuid: UUID }], (sql, params) => {
            capturedSql = sql;
            capturedParams = params;
        });

        const result = await submit({ emailAddress: input });

        assert.strictEqual(capturedSql, USERS_ACCOUNTS.GET_BY_EMAIL, 'the query constant is used as-is');
        assert.ok(!capturedSql.includes(input), 'the input is never interpolated into SQL');
        assert.deepStrictEqual(capturedParams, [input]);
        assert.strictEqual(result.body.message, 'found');
        assertNoCredentialMaterial(result);
    }
});

// --- Query + source invariants --------------------------------------------

test('GET_BY_EMAIL is parameterized and no longer selects password', () => {
    assert.match(USERS_ACCOUNTS.GET_BY_EMAIL, /WHERE\s+email_or_social_media\s*=\s*\?/);
    assert.doesNotMatch(USERS_ACCOUNTS.GET_BY_EMAIL, /\bpassword\b/i);
    assert.match(USERS_ACCOUNTS.GET_BY_EMAIL, /\buuid\b/);
});

test('the model and controller sources contain no password/session passthrough', () => {
    const modelSource = fs.readFileSync(MODEL_PATH, 'utf8');
    const controllerSource = fs.readFileSync(CONTROLLER_PATH, 'utf8');

    assert.doesNotMatch(modelSource, /res\[0\]\.password/);
    assert.doesNotMatch(modelSource, /forgotPassword\s*=/);
    assert.doesNotMatch(modelSource, /this\.session\s*=/);
    assert.doesNotMatch(controllerSource, /session\s*:\s*req\.session/);
    assert.doesNotMatch(controllerSource, /data\.password|\.password\b/);
});

test('the client still uses only message, email_or_social_media, and uuid', () => {
    const clientSource = fs.readFileSync(
        path.join(__dirname, '..', 'public', 'assets', 'js', 'forgot-password.js'),
        'utf8',
    );

    assert.doesNotMatch(clientSource, /res\.password/);
    assert.match(clientSource, /res\.message\s*===\s*'found'/);
    assert.match(clientSource, /createResetToken\(res\.email_or_social_media,\s*res\.uuid\)/);
});
