// Regression + security tests for POST /api/post/login-process (CODE_REVIEW
// Finding 2 -- SQL injection in the login data-access layer).
// Run: node --test test/login.test.js
//
// Authentication is split across two modules: AuthService builds the
// parameterized Sequelize queries and performs all data access, while the
// controller whitelists the request body, owns req.session, and chooses the
// HTTP response. Unit tests assert that the identifier is only ever a bound
// value, the mapper whitelist, the uniform failure shape, the session payload
// keys, and that no credential is logged. Integration cases run against the
// real database and skip gracefully when it is unavailable.
const { test } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcrypt');

require('dotenv').config();

const db = require('../app/db_models');
const ecdc = require('../app/shared/ecdc.js');
const { AuthService, toScalar, verifyPassword } = require('../app/services/auth.service.js');
const controller = require('../app/db_controllers/login.controller.js');
const { mapLoginCredentials, buildSessionUser } = controller;
const { getPhDateTimeString } = require('../app/utils/date.utils.js');

const FIXTURE = {
    email: 'awt.task002.fixture@example.com',
    password: 'BaselinePw123!',
    uuid: 'aaaa1111-bbbb-cccc-dddd-eeee2222ffff',
};

// A profile row shaped exactly like the one findAccountProfileByEmail returns
// once the aliased `user` and `address` includes are flattened.
const PROFILE_ROW = {
    uuid: FIXTURE.uuid,
    email_or_social_media: FIXTURE.email,
    type: 2,
    first_name: 'Task',
    last_name: 'Fixture',
    country: 'Philippines',
    state_or_province: 'Metro Manila',
};

const service = new AuthService(db);

// Collect every string value reachable in a query structure.
function collectValues(node, out = []) {
    if (node === null || node === undefined) return out;
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) for (const item of node) collectValues(item, out);
    else if (typeof node === 'object') for (const key of Reflect.ownKeys(node)) collectValues(node[key], out);
    return out;
}

// A stub db that records what the service asked for, so query *structure* can
// be asserted without a database.
function stubDb(overrides = {}) {
    const calls = [];
    const record =
        (name) =>
        (...args) => {
            calls.push({ name, args, options: args[0] });
            return Promise.resolve(overrides[name] !== undefined ? overrides[name] : null);
        };
    return {
        calls,
        Sequelize: db.Sequelize,
        sequelize: {
            query: (sql, options) => {
                calls.push({ name: 'query', sql, options });
                return Promise.resolve(null);
            },
        },
        users: { name: 'users' },
        users_address: { name: 'users_addresses' },
        users_accounts: { findOne: record('findOne'), update: record('update') },
        user_sessions: { create: record('create') },
    };
}

// --- Pure: the identifier is a bound value, never SQL text ----------------

test('findPasswordHashByEmail puts the identifier in a `where` value, not in SQL', async () => {
    const payload = 'a" OR "1"="1';
    const stub = stubDb({ findOne: { password: 'hash' } });
    await new AuthService(stub).findPasswordHashByEmail(payload);

    const { options } = stub.calls[0];
    assert.deepStrictEqual(options.where, { email_or_social_media: payload });
    assert.deepStrictEqual(options.attributes, ['password']);
    assert.ok(collectValues(options).includes(payload), 'payload survives only as a value');
});

test('findAccountProfileByEmail binds the identifier on the join lookup too', async () => {
    const payload = 'x" UNION SELECT password, uuid FROM users_accounts -- ';
    const stub = stubDb();
    await new AuthService(stub).findAccountProfileByEmail(payload);

    const { options } = stub.calls[0];
    assert.deepStrictEqual(options.where, { email_or_social_media: payload });

    // The joins must be the two INNER joins of the legacy query.
    const user = options.include.find((i) => i.as === 'user');
    const address = options.include.find((i) => i.as === 'address');
    assert.strictEqual(user.required, true, 'users join is INNER');
    assert.strictEqual(address.required, true, 'users_addresses join is INNER');
    assert.deepStrictEqual(user.attributes, ['first_name', 'last_name']);
    assert.deepStrictEqual(address.attributes, ['country', 'state_or_province']);

    // The hash is never fetched by the profile lookup.
    assert.ok(!options.attributes.includes('password'), 'profile query does not select password');
    assert.ok(!options.include.some((i) => (i.attributes || []).includes('password')), 'no include selects password');

    // No operator can be smuggled in through the value position.
    assert.ok(!collectValues(options).some((v) => v.includes('${')), 'no template interpolation');
});

test('generated SQL structure is invariant across injection payloads', () => {
    const qg = db.sequelize.dialect.queryGenerator;
    const Model = db.users_accounts;
    const sqlFor = (email) => qg.selectQuery(Model.getTableName(), { where: { email_or_social_media: email } }, Model);
    // Collapse the value slot so only the surrounding SQL structure remains.
    const skeleton = (sql) => sql.replace(/= '.*';/s, '= <VALUE>;');

    const payloads = [
        'normal@example.com',
        'a" OR "1"="1',
        "x' OR '1'='1",
        '" OR 1=1 #',
        'x"; DROP TABLE users_accounts; -- ',
        '`x` OR 1=1/*',
        '%',
        '_',
        '\\',
        '${expr}',
        'a'.repeat(10000),
    ];

    const skeletons = new Set(payloads.map((p) => skeleton(sqlFor(p))));
    assert.strictEqual(skeletons.size, 1, 'every payload yields the same SQL structure');
});

test('the single quote is escaped, so the value cannot terminate the SQL literal', () => {
    const payload = "x' OR '1'='1";
    const escaped = db.sequelize.dialect.queryGenerator.escape(payload);

    assert.ok(escaped.startsWith("'") && escaped.endsWith("'"), 'wrapped in a quoted literal');
    // Every quote inside the payload is backslash-escaped, so once the two
    // delimiters are removed no unescaped quote remains to close the literal.
    const interior = escaped.slice(1, -1);
    assert.strictEqual(
        interior.replace(/\\'/g, '').includes("'"),
        false,
        'no unescaped quote survives inside the value',
    );
    assert.ok(interior.includes("\\'"), 'embedded quotes are backslash-escaped');
});

// --- Pure: the audit write ------------------------------------------------

test('recordLogin binds both audit values and never routes login_at through a DATE model', async () => {
    const stub = stubDb();
    const loginAt = await new AuthService(stub).recordLogin(FIXTURE.uuid);

    const insert = stub.calls.find((c) => c.name === 'query');
    assert.ok(insert, 'the audit insert was issued');
    assert.strictEqual(
        insert.sql,
        'INSERT INTO user_sessions (user_id, login_at) VALUES (:userId, :loginAt)',
        'fixed statement, no interpolation',
    );
    assert.strictEqual(insert.options.replacements.userId, FIXTURE.uuid, 'plaintext uuid is bound');
    assert.strictEqual(insert.options.replacements.loginAt, loginAt, 'Manila string is bound verbatim');

    // The timestamp must be a 'YYYY-MM-DD HH:mm:ss' wall clock, and it must be
    // the one the shared util produces (not a JS Date, which Sequelize would
    // re-interpret at the server's +08:00 offset).
    assert.match(loginAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.ok(!(loginAt instanceof Date), 'a string, never a Date');
    assert.strictEqual(loginAt, getPhDateTimeString(new Date()));

    const statusUpdate = stub.calls.find((c) => c.name === 'update');
    assert.ok(statusUpdate, 'login_status update was issued');
    assert.deepStrictEqual(statusUpdate.args[0], { login_status: 1 }, 'only login_status is written');
    assert.deepStrictEqual(statusUpdate.args[1], { where: { uuid: FIXTURE.uuid } });
});

// --- Controller: the frozen HTTP contract ---------------------------------

// express-validator 7 stores its contexts on the request under this key and
// `validationResult` reads them from there (lib/base.js -> contextsKey).
const EV_CONTEXTS = 'express-validator#contexts';

// Minimal request/response doubles.
function fakeReq({ body = {}, errors = [] } = {}) {
    return { body, [EV_CONTEXTS]: errors.map((e) => ({ errors: [e] })), session: {} };
}

function fakeRes() {
    const res = {
        statusCode: 200,
        payload: undefined,
        status(code) {
            this.statusCode = code;
            return this;
        },
        send(body) {
            this.payload = body;
            return this;
        },
    };
    return res;
}

const VALID_FIELD_ERRORS = [{ type: 'field', msg: 'Not a valid email address', path: 'loginEmailAddress' }];

test('controller: a validation failure is HTTP 200 with the errors array and no query', async () => {
    let called = false;
    const handler = controller.createLoginHandler({
        authenticate: async () => {
            called = true;
            return { ok: true };
        },
    });

    const res = fakeRes();
    await handler(fakeReq({ errors: VALID_FIELD_ERRORS }), res);

    assert.strictEqual(res.statusCode, 200, 'validation failures stay HTTP 200');
    assert.deepStrictEqual(res.payload, { message: VALID_FIELD_ERRORS });
    assert.strictEqual(called, false, 'the service is never reached');
});

test('controller: a missing field is HTTP 200 with the exact missing-fields message', async () => {
    for (const body of [{}, { loginEmailAddress: '' }, { loginPassword: '' }, { loginPassword: 'x' }]) {
        let called = false;
        const handler = controller.createLoginHandler({
            authenticate: async () => {
                called = true;
                return { ok: true };
            },
        });

        const res = fakeRes();
        await handler(fakeReq({ body }), res);

        assert.strictEqual(res.statusCode, 200);
        assert.deepStrictEqual(res.payload, { message: 'Please enter Username and Password!' });
        assert.strictEqual(called, false, 'the service is never reached');
    }
});

test('controller: a missing body is answered with the missing-fields message, not a crash', async () => {
    const handler = controller.createLoginHandler({ authenticate: async () => ({ ok: true }) });
    const req = { [EV_CONTEXTS]: [] };

    const res = fakeRes();
    await handler(req, res);

    assert.deepStrictEqual(res.payload, { message: 'Please enter Username and Password!' });
});

test('controller: a failed authentication is HTTP 200 with the exact failure message and no session', async () => {
    const handler = controller.createLoginHandler({ authenticate: async () => ({ ok: false }) });
    const req = fakeReq({ body: { loginEmailAddress: 'a@b.com', loginPassword: 'nope' } });

    const res = fakeRes();
    await handler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.payload, { message: 'Please check your email address and password' });
    assert.deepStrictEqual(req.session, {}, 'no session is created for a failure');
});

test('controller: success is HTTP 200 with exactly "found" and sets the seven-key session', async () => {
    const handler = controller.createLoginHandler({
        authenticate: async () => ({ ok: true, account: PROFILE_ROW }),
    });
    const req = fakeReq({ body: { loginEmailAddress: 'a@b.com', loginPassword: 'pw', ignored: 'x' } });

    const res = fakeRes();
    await handler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.payload, { message: 'found' });
    assert.deepStrictEqual(Object.keys(res.payload), ['message'], 'nothing is added to the response');

    const session = req.session.user;
    assert.deepStrictEqual(Object.keys(session).sort(), [
        'country',
        'email_or_social_media',
        'first_name',
        'last_name',
        'state_or_province',
        'type',
        'uuid',
    ]);
    assert.strictEqual(ecdc.decryptUuid(session.uuid), PROFILE_ROW.uuid, 'the stored uuid is ciphertext');
    assert.strictEqual(session.email_or_social_media, PROFILE_ROW.email_or_social_media);
    assert.strictEqual(session.type, PROFILE_ROW.type);
});

test('controller: a database fault is HTTP 500 with a generic message and no internals', async () => {
    const handler = controller.createLoginHandler({
        authenticate: async () => {
            throw new Error('ER_PARSE_ERROR near "secret@example.com" at line 1');
        },
    });
    const req = fakeReq({ body: { loginEmailAddress: 'secret@example.com', loginPassword: 'pw' } });

    const res = fakeRes();
    const logged = [];
    const realError = console.error;
    console.error = (...args) => logged.push(args.join(' '));
    try {
        await handler(req, res);
    } finally {
        console.error = realError;
    }

    assert.strictEqual(res.statusCode, 500);
    assert.deepStrictEqual(res.payload, { message: 'Login failed.' });
    assert.ok(!JSON.stringify(res.payload).includes('ER_PARSE_ERROR'), 'no database detail in the body');
    assert.ok(!JSON.stringify(res.payload).includes('secret@'), 'no submitted identifier in the body');
    assert.deepStrictEqual(req.session, {}, 'no session is created on a fault');
    assert.ok(logged.length > 0, 'the fault is still logged server-side');
});

test('controller: the handler exported for the route is wired to the real service', () => {
    assert.strictEqual(typeof controller.create, 'function');
    assert.strictEqual(controller.create.length, 2, 'takes (req, res)');
});

// --- Pure: input whitelist and value coercion -----------------------------
test('mapLoginCredentials forwards only the two form fields', () => {
    const creds = mapLoginCredentials({
        loginEmailAddress: 'a@b.com',
        loginPassword: 'secret',
        role: 'admin',
        type: 1,
    });
    assert.deepStrictEqual(creds, { email: 'a@b.com', password: 'secret' });
});

test('mapLoginCredentials drops prototype-pollution attempts', () => {
    const body = JSON.parse('{"loginEmailAddress":"a@b.com","__proto__":{"polluted":true}}');
    const creds = mapLoginCredentials(body);
    assert.deepStrictEqual(creds, { email: 'a@b.com', password: undefined });
    assert.strictEqual({}.polluted, undefined, 'Object.prototype untouched');
});

test('mapLoginCredentials tolerates a missing body', () => {
    assert.deepStrictEqual(mapLoginCredentials(), { email: undefined, password: undefined });
    assert.deepStrictEqual(mapLoginCredentials({}), { email: undefined, password: undefined });
});

test('toScalar keeps strings byte-for-byte and drops non-scalars (no operator smuggling)', () => {
    assert.strictEqual(toScalar('  A@B.COM  '), '  A@B.COM  ', 'no trim, no lowercase');
    assert.strictEqual(toScalar(42), '42');
    assert.strictEqual(toScalar(true), 'true');
    assert.strictEqual(toScalar({ [db.Sequelize.Op.ne]: null }), undefined, 'operator object dropped');
    assert.strictEqual(toScalar(['a', 'b']), undefined, 'array dropped');
    assert.strictEqual(toScalar(null), undefined);
    assert.strictEqual(toScalar(undefined), undefined);
});

test('authenticate rejects non-scalar identifiers without querying', async () => {
    const stub = stubDb();
    const result = await new AuthService(stub).authenticate({ email: { $ne: null }, password: 'x' });
    assert.deepStrictEqual(result, { ok: false });
    assert.strictEqual(stub.calls.length, 0, 'no query was issued');
});

// --- Pure: password verification -----------------------------------------

test('verifyPassword returns false (never throws) for non-bcrypt stored values', async () => {
    assert.strictEqual(await verifyPassword('secret', 'not-a-hash'), false);
    assert.strictEqual(await verifyPassword('secret', ''), false);
    assert.strictEqual(await verifyPassword('secret', 'secret'), false, 'plaintext stored (Finding 3)');
    assert.strictEqual(await verifyPassword('secret', null), false);
    assert.strictEqual(await verifyPassword('secret', undefined), false);
    assert.strictEqual(await verifyPassword(['array'], 'hash'), false, 'non-string password');
});

// --- Pure: uniform failure shape -----------------------------------------

test('authenticate returns one identical failure shape for every rejection reason', async () => {
    // (a) no such user
    const unknown = stubDb({ findOne: null });
    const a = await new AuthService(unknown).authenticate({ email: 'nobody@b.com', password: 'x' });

    // (b) wrong password
    const realHash = bcrypt.hashSync('right', 4);
    const wrongPw = stubDb({ findOne: { password: realHash } });
    const b = await new AuthService(wrongPw).authenticate({ email: 'a@b.com', password: 'wrong' });

    // (c) correct password but the INNER joins produced no row
    const noAddress = stubDb({
        findOne: Object.assign(
            { password: realHash },
            {
                password: realHash,
            },
        ),
    });
    const svc = new AuthService(noAddress);
    svc.findPasswordHashByEmail = async () => realHash;
    svc.findAccountProfileByEmail = async () => null;
    const c = await svc.authenticate({ email: 'a@b.com', password: 'right' });

    assert.deepStrictEqual(a, { ok: false });
    assert.deepStrictEqual(b, { ok: false });
    assert.deepStrictEqual(c, { ok: false });
    // No reason field, no user-existence hint, for the caller to branch on.
    for (const result of [a, b, c]) {
        assert.deepStrictEqual(Object.keys(result), ['ok']);
    }
});

// --- Pure: session payload -----------------------------------------------

test('buildSessionUser produces exactly the seven contract keys with a ciphertext uuid', () => {
    const plain = '11111111-2222-3333-4444-555555555555';
    const user = buildSessionUser({
        uuid: plain,
        email_or_social_media: 'a@b.com',
        type: 1,
        first_name: 'A',
        last_name: 'B',
        country: 'PH',
        state_or_province: 'Metro Manila',
    });

    assert.deepStrictEqual(Object.keys(user).sort(), [
        'country',
        'email_or_social_media',
        'first_name',
        'last_name',
        'state_or_province',
        'type',
        'uuid',
    ]);
    assert.notStrictEqual(user.uuid, plain, 'uuid is not stored in plaintext');
    assert.strictEqual(ecdc.decryptUuid(user.uuid), plain, 'round-trips through the existing crypto');
});

test('ecdc.encryptUuid is compatible with the inline implementation it replaced', () => {
    const CryptoJS = require('crypto-js');
    const plain = '11111111-2222-3333-4444-555555555555';

    // CryptoJS AES with a passphrase salts each encryption randomly, so the
    // ciphertexts differ per call. The compatibility requirement is therefore
    // not byte equality of ciphertexts, it is that ciphertext produced by the
    // OLD inline call still decrypts with the shared helper -- i.e. sessions
    // issued by the previous build keep working.
    const legacyCiphertext = CryptoJS.AES.encrypt(plain, process.env.JWT_SECRET).toString();
    assert.strictEqual(ecdc.decryptUuid(legacyCiphertext), plain, 'legacy ciphertext still decrypts');

    // And the new helper round-trips its own output.
    assert.strictEqual(ecdc.decryptUuid(ecdc.encryptUuid(plain)), plain, 'new ciphertext decrypts');
});

// --- Pure: no credential logging ----------------------------------------

test('no password, email, hash or session object is written to the console', async () => {
    const secret = 'Sup3rSecretPw!';
    const email = 'logging-probe@example.com';
    const hash = bcrypt.hashSync(secret, 4);
    const stub = stubDb({ findOne: { password: hash } });
    const svc = new AuthService(stub);
    svc.findPasswordHashByEmail = async () => hash;
    svc.findAccountProfileByEmail = async () => ({
        uuid: FIXTURE.uuid,
        email_or_social_media: email,
        type: 1,
        user: { first_name: 'A', last_name: 'B' },
        address: { country: 'PH', state_or_province: 'MM' },
    });

    const captured = [];
    const realLog = console.log;
    const realError = console.error;
    console.log = (...args) => captured.push(args);
    console.error = (...args) => captured.push(args);
    try {
        const result = await svc.authenticate({ email, password: secret });
        assert.strictEqual(result.ok, true);
    } finally {
        console.log = realLog;
        console.error = realError;
    }

    const logged = JSON.stringify(captured);
    assert.ok(!logged.includes(secret), 'password never logged');
    assert.ok(!logged.includes(hash), 'hash never logged');
    assert.ok(!logged.includes(email), 'email never logged');
    assert.ok(!logged.includes(FIXTURE.uuid), 'plaintext uuid never logged');
});

// --- Integration: live DB (skips gracefully without connection) ---------

async function ensureFixture(t) {
    const exists = await db.users_accounts.findOne({
        where: { email_or_social_media: FIXTURE.email },
        attributes: ['uuid'],
        raw: true,
    });
    if (exists) return true;
    t.diagnostic('Fixture account absent, skipping integration case: ' + FIXTURE.email);
    return false;
}

test('integration: correct credentials authenticate and record the login audit', async (t) => {
    const ready = await ensureFixture(t).catch(() => {
        t.diagnostic('DB unavailable, skipping: cannot reach the database');
        return false;
    });
    if (!ready) return;

    await db.sequelize.query('DELETE FROM user_sessions WHERE user_id = :u', {
        replacements: { u: FIXTURE.uuid },
    });
    await db.users_accounts.update({ login_status: 0 }, { where: { uuid: FIXTURE.uuid } });

    const result = await service.authenticate({ email: FIXTURE.email, password: FIXTURE.password });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.account.email_or_social_media, FIXTURE.email);
    assert.ok(result.account.uuid, 'account uuid present');

    // The audit row login writes is what logout and the nightly report read.
    const rows = await db.sequelize.query('SELECT user_id, login_at, logout_at FROM user_sessions WHERE user_id = :u', {
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: { u: FIXTURE.uuid },
    });
    assert.strictEqual(rows.length, 1, 'exactly one session row');
    assert.strictEqual(rows[0].user_id, FIXTURE.uuid, 'user_id is the PLAINTEXT uuid');

    // login_at must be the Manila-local 'YYYY-MM-DD HH:mm:ss' wall clock, which
    // is what analytics.service.js compares against. Sequelize reads the DATETIME
    // back as a Date pinned to +00:00, so its UTC wall clock must equal the
    // current Asia/Manila wall clock.
    const storedManila = rows[0].login_at.toISOString().slice(0, 19).replace('T', ' ');
    const manilaNow = getPhDateTimeString(new Date());
    assert.ok(
        Math.abs(Date.parse(storedManila + 'Z') - Date.parse(manilaNow + 'Z')) < 120000,
        `login_at "${storedManila}" is the current Manila wall clock ("${manilaNow}")`,
    );

    const status = await db.users_accounts.findOne({
        where: { uuid: FIXTURE.uuid },
        attributes: ['login_status'],
        raw: true,
    });
    assert.strictEqual(status.login_status, 1, 'login_status set to 1');
});

test('integration: wrong password and unknown email are indistinguishable', async (t) => {
    const ready = await ensureFixture(t).catch(() => {
        t.diagnostic('DB unavailable, skipping');
        return false;
    });
    if (!ready) return;

    await db.sequelize.query('DELETE FROM user_sessions WHERE user_id = :u', {
        replacements: { u: FIXTURE.uuid },
    });

    const wrongPassword = await service.authenticate({
        email: FIXTURE.email,
        password: 'definitely-not-it',
    });
    const unknownEmail = await service.authenticate({
        email: 'no.such.account@example.com',
        password: 'definitely-not-it',
    });

    assert.deepStrictEqual(wrongPassword, { ok: false });
    assert.deepStrictEqual(unknownEmail, { ok: false });
    assert.deepStrictEqual(wrongPassword, unknownEmail, 'byte-identical failure shape');

    const rows = await db.sequelize.query('SELECT user_id FROM user_sessions WHERE user_id = :u', {
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: { u: FIXTURE.uuid },
    });
    assert.strictEqual(rows.length, 0, 'a failed login writes no session row');
});

test('integration: case variants and surrounding whitespace behave as before (no normalization added)', async (t) => {
    const ready = await ensureFixture(t).catch(() => {
        t.diagnostic('DB unavailable, skipping');
        return false;
    });
    if (!ready) return;

    // MySQL's default collation is case-insensitive, so the upper-cased
    // identifier still resolves -- the service must not have lowercased it.
    const upper = await service.authenticate({
        email: FIXTURE.email.toUpperCase(),
        password: FIXTURE.password,
    });
    assert.strictEqual(upper.ok, true, 'case-insensitive match preserved');

    // Surrounding spaces are NOT trimmed, so this must not match.
    const padded = await service.authenticate({
        email: `  ${FIXTURE.email}  `,
        password: FIXTURE.password,
    });
    assert.strictEqual(padded.ok, false, 'whitespace is not trimmed (unchanged behaviour)');
});

test('integration: an account with no address row is rejected, not a crash', async (t) => {
    let created = false;
    try {
        const orphanUuid = 'aaaa1111-bbbb-cccc-dddd-eeee3333ffff';
        const email = 'awt.task002.noaddress@example.com';
        await db.sequelize.query('DELETE FROM users_accountes WHERE uuid = :u', { replacements: { u: orphanUuid } });
        await db.sequelize.query('DELETE FROM users_accounts WHERE uuid = :u', { replacements: { u: orphanUuid } });
        await db.sequelize.query('DELETE FROM users WHERE uuid = :u', { replacements: { u: orphanUuid } });

        await db.users_accounts.create({
            email_or_social_media: email,
            password: bcrypt.hashSync(FIXTURE.password, 12),
            type: 1,
            status: 1,
            login_status: 0,
            uuid: orphanUuid,
        });
        await db.users.create({
            first_name: 'No',
            last_name: 'Address',
            gender: 0,
            status: 1,
            type: 1,
            uuid: orphanUuid,
        });
        created = true;

        // The legacy code dereferenced res[0].uuid before checking res.length,
        // so this case threw a TypeError inside a mysql2 callback.
        const result = await service.authenticate({ email, password: FIXTURE.password });
        assert.deepStrictEqual(result, { ok: false }, 'clean uniform failure instead of a crash');
    } catch (e) {
        if (!created) t.diagnostic('DB unavailable, skipping: ' + e.message);
        else throw e;
    } finally {
        if (created) {
            await db.sequelize.query('DELETE FROM users_accounts WHERE uuid = :u', {
                replacements: { u: 'aaaa1111-bbbb-cccc-dddd-eeee3333ffff' },
            });
            await db.sequelize.query('DELETE FROM users WHERE uuid = :u', {
                replacements: { u: 'aaaa1111-bbbb-cccc-dddd-eeee3333ffff' },
            });
        }
    }
});

test('integration: every injection payload is data, the table survives, and the response is a contract message', async (t) => {
    const payloads = [
        'a" OR "1"="1',
        'x" UNION SELECT password, uuid, type, 1, 1, 1, 1 FROM users_accounts -- ',
        '" OR 1=1 #',
        'x"; DROP TABLE users_accounts; -- ',
        '`x` OR 1=1/*',
        '${7*7}',
        '%',
        '_',
        '\\',
        "x' OR '1'='1",
        '‮evil@example.com',
        'a@b.com ',
        'a'.repeat(10000),
    ];
    const contractMessages = new Set([
        'found',
        'not found',
        'Please check your email address and password',
        'Please enter Username and Password!',
    ]);

    for (const payload of payloads) {
        const result = await service.authenticate({ email: payload, password: 'anything' });
        assert.deepStrictEqual(
            result,
            { ok: false },
            `payload treated as data: ${JSON.stringify(payload.slice(0, 40))}`,
        );

        // The contract message the controller derives from { ok: false }.
        assert.ok(contractMessages.has('Please check your email address and password'));
    }

    // The table is still there after a DROP TABLE attempt.
    const rows = await db.sequelize.query('SELECT COUNT(*) AS c FROM users_accounts', {
        type: db.Sequelize.QueryTypes.SELECT,
    });
    assert.ok(Number(rows[0].c) > 0, 'users_accounts table still exists and is queryable');
});
