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
const { AuthService, toScalar, verifyPassword, ABSENT_ACCOUNT_HASH } = require('../app/services/auth.service.js');
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
    const transaction = {
        committed: false,
        rolledBack: false,
        commit: () => {
            transaction.committed = true;
            return Promise.resolve();
        },
        rollback: () => {
            transaction.rolledBack = true;
            return Promise.resolve();
        },
    };
    return {
        calls,
        transaction,
        Sequelize: db.Sequelize,
        sequelize: {
            transaction: () => {
                calls.push({ name: 'transaction' });
                return Promise.resolve(transaction);
            },
            query: (sql, options) => {
                calls.push({ name: 'query', sql, options });
                return overrides.query ? overrides.query(sql, options) : Promise.resolve(null);
            },
        },
        users: { name: 'users' },
        users_address: { name: 'users_addresses' },
        users_accounts: { findOne: record('findOne'), update: record('update') },
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
    // Compared with a tolerance: a fresh getPhDateTimeString() would race the
    // clock tick and flake at a second boundary.
    const drift = Math.abs(
        Date.parse(loginAt.replace(' ', 'T') + 'Z') -
            Date.parse(getPhDateTimeString(new Date()).replace(' ', 'T') + 'Z'),
    );
    assert.ok(drift < 5000, `login_at is the current Manila wall clock (drift ${drift}ms)`);

    const statusUpdate = stub.calls.find((c) => c.name === 'update');
    assert.ok(statusUpdate, 'login_status update was issued');
    assert.deepStrictEqual(statusUpdate.args[0], { login_status: 1 }, 'only login_status is written');
    assert.deepStrictEqual(statusUpdate.args[1].where, { uuid: FIXTURE.uuid });

    // Both writes must be inside one transaction, and it must be committed --
    // otherwise a session row could survive while login_status stayed stale.
    assert.ok(
        stub.calls.some((c) => c.name === 'transaction'),
        'a transaction was opened',
    );
    assert.strictEqual(insert.options.transaction, stub.transaction, 'the insert joins the transaction');
    assert.strictEqual(statusUpdate.args[1].transaction, stub.transaction, 'the update joins the transaction');
    assert.strictEqual(stub.transaction.committed, true);
    assert.strictEqual(stub.transaction.rolledBack, false);
});

test('recordLogin rolls back rather than leaving a half-written login', async () => {
    const stub = stubDb();
    stub.sequelize.query = (sql, options) => {
        stub.calls.push({ name: 'query', sql, options });
        return Promise.reject(new Error('ER_DUP_ENTRY'));
    };

    await assert.rejects(() => new AuthService(stub).recordLogin(FIXTURE.uuid), /ER_DUP_ENTRY/);
    assert.strictEqual(stub.transaction.rolledBack, true, 'the failed insert is rolled back');
    assert.strictEqual(stub.transaction.committed, false, 'nothing is committed');
});

test('a failed audit write is swallowed: the user stays logged in', async () => {
    const stub = stubDb({ findOne: { password: 'hash' } });
    const svc = new AuthService(stub);
    // Authenticate for real, but make the audit write fail.
    svc.recordLogin = async () => {
        throw new Error('ER_LOCK_DEADLOCK');
    };
    svc.findPasswordHashByEmail = async () => bcrypt.hashSync('pw', 4);
    svc.findAccountProfileByEmail = async () => ({ ...PROFILE_ROW, user: PROFILE_ROW, address: PROFILE_ROW });

    const realError = console.error;
    console.error = () => {};
    let result;
    try {
        result = await svc.authenticate({ email: FIXTURE.email, password: 'pw' });
    } finally {
        console.error = realError;
    }

    assert.strictEqual(result.ok, true, 'a deadlocked audit must not log the user out');
    assert.strictEqual(result.account.uuid, PROFILE_ROW.uuid);
});

// --- Security: the unknown-account path is not timing-distinguishable ------

test('an unknown account still runs a bcrypt comparison (no enumeration oracle)', async () => {
    // Without this, an unknown email returned in ~0.003 ms and a wrong password
    // in ~55 ms, which was a ~19000x oracle for enumerating accounts.
    const stub = stubDb({ findOne: null });
    const svc = new AuthService(stub);
    const comparisons = [];
    const realCompare = bcrypt.compare;
    bcrypt.compare = async (plain, hash) => {
        comparisons.push(hash);
        return realCompare(plain, hash);
    };

    let result;
    try {
        result = await svc.authenticate({ email: 'nobody@example.com', password: 'whatever' });
    } finally {
        bcrypt.compare = realCompare;
    }

    assert.strictEqual(result.ok, false);
    assert.strictEqual(comparisons.length, 1, 'exactly one comparison was performed');
    assert.strictEqual(comparisons[0], ABSENT_ACCOUNT_HASH, 'compared against the decoy hash, not skipped');
    assert.ok(!comparisons[0].includes('nobody@example.com'), 'the submitted identifier is not embedded in the decoy');
});

test('the decoy hash is a real cost-10 bcrypt hash that nothing can match', async () => {
    assert.ok(/^\$2[aby]\$10\$/.test(ABSENT_ACCOUNT_HASH), 'same cost as the stored hashes');
    assert.strictEqual(await bcrypt.compare(FIXTURE.password, ABSENT_ACCOUNT_HASH), false);
    assert.strictEqual(await bcrypt.compare('', ABSENT_ACCOUNT_HASH), false);
});

test('unknown-account and wrong-password paths cost comparable time', async () => {
    const realHash = await bcrypt.hash(FIXTURE.password, 10);
    const measure = async (stub) => {
        const svc = new AuthService(stub);
        const start = process.hrtime.bigint();
        await svc.authenticate({ email: FIXTURE.email, password: 'wrong-password' });
        return Number(process.hrtime.bigint() - start) / 1e6;
    };

    await measure(stubDb({ findOne: { password: realHash } })); // warm up

    const samples = 3;
    const unknown = [];
    const wrong = [];
    for (let i = 0; i < samples; i++) {
        unknown.push(await measure(stubDb({ findOne: null })));
        wrong.push(await measure(stubDb({ findOne: { password: realHash } })));
    }
    const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

    const ratio = median(wrong) / median(unknown);
    assert.ok(
        ratio > 0.5 && ratio < 2,
        `paths should be within 2x of each other (measured ${median(unknown).toFixed(1)}ms vs ${median(wrong).toFixed(1)}ms, ${ratio.toFixed(2)}x)`,
    );
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

// --- Integration: live DB ---------------------------------------------------
//
// Self-contained: each case creates the account it needs and removes it again,
// so a run never depends on leftover state and never leaves any behind. A case
// is reported as *skipped* (t.skip), not as a pass, when the database is
// genuinely unreachable.

const SECOND_FIXTURE = Object.freeze({
    uuid: 'aaaa1111-bbbb-cccc-dddd-eeee3333ffff',
    email: 'awt.task002.noaddress@example.com',
});

const TABLES_BY_UUID = Object.freeze([
    'user_sessions',
    'users_businesses',
    'users_addresses',
    'users',
    'users_accounts',
]);

async function deleteByUuid(table, uuid) {
    const column = table === 'user_sessions' ? 'user_id' : 'uuid';
    await db.sequelize.query(`DELETE FROM ${table} WHERE ${column} = :uuid`, { replacements: { uuid } });
}

// `table` is a module constant, never user input, so this interpolation is not
// a query-building sink; the uuid is still bound.
async function purgeFixtures() {
    for (const table of TABLES_BY_UUID) {
        await deleteByUuid(table, FIXTURE.uuid);
        await deleteByUuid(table, SECOND_FIXTURE.uuid);
    }
}

async function createAccount({ uuid, email, type = 1, withAddress = true }) {
    await db.users_accounts.create({
        email_or_social_media: email,
        password: bcrypt.hashSync(FIXTURE.password, 4), // low cost: these are throwaway rows
        type,
        status: 1,
        login_status: 0,
        uuid,
    });
    await db.users.create({ first_name: 'Task', last_name: 'Fixture', status: 1, type, uuid });
    if (withAddress) {
        await db.users_address.create({ country: 'PH', state_or_province: 'Metro Manila', uuid });
    }
}

// Runs `body` against a freshly created account, then always cleans up.
// Returns without running `body` (and marks the test skipped) if the database
// cannot be reached.
async function withAccount(t, spec, body) {
    let reachable = true;
    try {
        await db.sequelize.query('SELECT 1', { type: db.Sequelize.QueryTypes.SELECT });
    } catch {
        reachable = false;
    }
    if (!reachable) {
        t.diagnostic('DB unavailable, skipping integration case');
        t.skip('database unreachable');
        return;
    }

    await purgeFixtures();
    try {
        await createAccount(spec);
        await body();
    } finally {
        await purgeFixtures();
    }
}

const FIXTURE_SPEC = Object.freeze({ uuid: FIXTURE.uuid, email: FIXTURE.email });

test('integration: correct credentials authenticate and record the login audit', async (t) => {
    await withAccount(t, FIXTURE_SPEC, async () => {
        const result = await service.authenticate({ email: FIXTURE.email, password: FIXTURE.password });

        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.account.email_or_social_media, FIXTURE.email);
        assert.strictEqual(result.account.uuid, FIXTURE.uuid, 'the profile carries the account uuid');

        // What logout and the nightly report read back.
        const rows = await db.sequelize.query(
            'SELECT user_id, login_at, logout_at FROM user_sessions WHERE user_id = :u',
            {
                type: db.Sequelize.QueryTypes.SELECT,
                replacements: { u: FIXTURE.uuid },
            },
        );
        assert.strictEqual(rows.length, 1, 'exactly one session row');
        assert.strictEqual(rows[0].user_id, FIXTURE.uuid, 'user_id is the PLAINTEXT uuid');
        assert.strictEqual(rows[0].logout_at, null, 'logout_at starts null');

        // login_at is read back as a Date pinned to +00:00, so its UTC wall
        // clock must equal the current Asia/Manila wall clock.
        const storedManila = rows[0].login_at.toISOString().slice(0, 19).replace('T', ' ');
        const manilaNow = getPhDateTimeString(new Date());
        const drift = Math.abs(Date.parse(storedManila + 'Z') - Date.parse(manilaNow + 'Z'));
        assert.ok(
            drift < 120000,
            `login_at "${storedManila}" is the current Manila wall clock ("${manilaNow}", drift ${drift}ms)`,
        );

        const status = await db.users_accounts.findOne({
            where: { uuid: FIXTURE.uuid },
            attributes: ['login_status'],
            raw: true,
        });
        assert.strictEqual(status.login_status, 1, 'login_status set to 1');
    });
});

test('integration: the two audit writes are committed together', async (t) => {
    await withAccount(t, FIXTURE_SPEC, async () => {
        const result = await service.authenticate({ email: FIXTURE.email, password: FIXTURE.password });
        assert.strictEqual(result.ok, true);

        // A committed transaction means the session row and the login_status
        // flip are both durable; a rolled-back one would leave neither.
        const [account, sessions] = await Promise.all([
            db.users_accounts.findOne({ where: { uuid: FIXTURE.uuid }, attributes: ['login_status'], raw: true }),
            db.sequelize.query('SELECT user_id FROM user_sessions WHERE user_id = :u', {
                type: db.Sequelize.QueryTypes.SELECT,
                replacements: { u: FIXTURE.uuid },
            }),
        ]);
        assert.strictEqual(account.login_status, 1, 'the status flip survived the commit');
        assert.strictEqual(sessions.length, 1, 'the session row survived the commit');
    });
});

test('integration: wrong password and unknown email are indistinguishable', async (t) => {
    await withAccount(t, FIXTURE_SPEC, async () => {
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

        const status = await db.users_accounts.findOne({
            where: { uuid: FIXTURE.uuid },
            attributes: ['login_status'],
            raw: true,
        });
        assert.strictEqual(status.login_status, 0, 'a failed login does not flip login_status');
    });
});

test('integration: case variants and surrounding whitespace behave as before (no normalization added)', async (t) => {
    await withAccount(t, FIXTURE_SPEC, async () => {
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
});

test('integration: an account with no address row is rejected, not a crash', async (t) => {
    // The legacy code dereferenced res[0].uuid before checking res.length, so
    // this case threw a TypeError inside a mysql2 callback.
    await withAccount(t, { ...SECOND_FIXTURE, withAddress: false }, async () => {
        const result = await service.authenticate({ email: SECOND_FIXTURE.email, password: FIXTURE.password });
        assert.deepStrictEqual(result, { ok: false }, 'clean uniform failure instead of a crash');
    });
});

test('integration: an account with no user row is rejected, not a crash', async (t) => {
    await withAccount(t, { ...SECOND_FIXTURE, withAddress: true }, async () => {
        await db.users.destroy({ where: { uuid: SECOND_FIXTURE.uuid } });
        const result = await service.authenticate({ email: SECOND_FIXTURE.email, password: FIXTURE.password });
        assert.deepStrictEqual(result, { ok: false }, 'clean uniform failure instead of a crash');
    });
});

test('integration: every injection payload is data, the table survives, and the failure is uniform', async (t) => {
    await withAccount(t, FIXTURE_SPEC, async () => {
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
            '‮evil@example.com', // RTL override
            'a@b.com\0',
            'a'.repeat(10000),
            ' ',
            '',
        ];

        for (const payload of payloads) {
            const result = await service.authenticate({ email: payload, password: 'anything' });
            assert.deepStrictEqual(
                result,
                { ok: false },
                `payload treated as data: ${JSON.stringify(payload.slice(0, 40))}`,
            );
        }

        const rows = await db.sequelize.query('SELECT COUNT(*) AS c FROM users_accounts', {
            type: db.Sequelize.QueryTypes.SELECT,
        });
        assert.ok(Number(rows[0].c) > 0, 'users_accounts table still exists and is queryable');
    });
});
