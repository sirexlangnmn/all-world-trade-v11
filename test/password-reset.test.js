// Regression + security tests for the password-reset path (CODE_REVIEW Finding
// 3 -- plaintext password storage on reset).
// Run: node --test test/password-reset.test.js
//
// The reset route delegates hashing to PasswordResetService. These tests prove
// the two properties that fix the finding: the stored value is always a fresh
// bcrypt cost-12 hash, and invalid input (including the legacy `password3`
// field) can never reach the update.
const { test } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcrypt');

require('dotenv').config();

const {
    PasswordResetService,
    hashPassword,
    assertPassword,
    PASSWORD_HASH_ROUNDS,
    MAX_PASSWORD_BYTES,
} = require('../app/services/password-reset.service.js');

const UUID = 'aaaa1111-bbbb-cccc-dddd-eeee3333ffff';
const PASSWORD = 'ResetMe123!';

function stubDb() {
    const updates = [];

    return {
        updates,
        users_accounts: {
            update: (...args) => {
                updates.push(args);
                return Promise.resolve([1]);
            },
        },
    };
}

// --- Hashing ---------------------------------------------------------------

test('hashPassword returns a cost-12 bcrypt hash that verifies only the original password', async () => {
    const hash = await hashPassword(PASSWORD);

    assert.match(hash, /^\$2[aby]\$12\$/);
    assert.notStrictEqual(hash, PASSWORD, 'the plaintext is not returned');
    assert.strictEqual(await bcrypt.compare(PASSWORD, hash), true);
    assert.strictEqual(await bcrypt.compare('wrong-password', hash), false);
});

test('each hash uses a unique salt', async () => {
    const first = await hashPassword(PASSWORD);
    const second = await hashPassword(PASSWORD);

    assert.notStrictEqual(first, second, 'identical passwords must not produce identical hashes');
    assert.strictEqual(await bcrypt.compare(PASSWORD, first), true);
    assert.strictEqual(await bcrypt.compare(PASSWORD, second), true);
});

test('the work factor matches PASSWORD_HASH_ROUNDS', async () => {
    const hash = await hashPassword(PASSWORD);
    const cost = parseInt(hash.split('$')[2], 10);

    assert.strictEqual(PASSWORD_HASH_ROUNDS, 12);
    assert.strictEqual(cost, PASSWORD_HASH_ROUNDS);
});

// --- Password validation ---------------------------------------------------

test('missing, empty, or non-string passwords are rejected before hashing', async () => {
    for (const value of [undefined, null, '', 123, true, ['a'], { password: 'x' }]) {
        await assert.rejects(() => hashPassword(value), TypeError, `rejects ${JSON.stringify(value)}`);
    }
});

test('passwords longer than bcrypt can consume are rejected explicitly', () => {
    assert.doesNotThrow(() => assertPassword('a'.repeat(MAX_PASSWORD_BYTES)));
    assert.throws(() => assertPassword('a'.repeat(MAX_PASSWORD_BYTES + 1)), /must not exceed/);
    assert.throws(() => assertPassword('€'.repeat(MAX_PASSWORD_BYTES)), /must not exceed/);
});

test('Unicode and SQL-shaped passwords are hashed as data', async () => {
    const secret = "Pässwörd-🦄-' OR 1=1 --";
    const hash = await hashPassword(secret);

    assert.match(hash, /^\$2[aby]\$12\$/);
    assert.notStrictEqual(hash, secret);
    assert.strictEqual(await bcrypt.compare(secret, hash), true);
});

// --- Service data flow -----------------------------------------------------

test('setNewPassword writes only a bcrypt hash, keyed by uuid, without touching updatedAt', async () => {
    const stub = stubDb();
    const service = new PasswordResetService(stub);

    const result = await service.setNewPassword(UUID, { password: PASSWORD, password2: PASSWORD });

    assert.strictEqual(result, undefined, 'the hash is never returned to the caller');
    assert.strictEqual(stub.updates.length, 1, 'exactly one update');

    const [values, options] = stub.updates[0];
    assert.deepStrictEqual(Object.keys(values), ['password'], 'only the password column is written');
    assert.notStrictEqual(values.password, PASSWORD, 'plaintext never reaches the database');
    assert.match(values.password, /^\$2[aby]\$12\$/);
    assert.strictEqual(await bcrypt.compare(PASSWORD, values.password), true);
    assert.deepStrictEqual(options, { where: { uuid: UUID }, silent: true });
});

test('a missing confirmation field is allowed and still hashes the password', async () => {
    const stub = stubDb();
    const service = new PasswordResetService(stub);

    await service.setNewPassword(UUID, { password: PASSWORD });

    assert.strictEqual(stub.updates.length, 1);
    assert.strictEqual(await bcrypt.compare(PASSWORD, stub.updates[0][0].password), true);
});

test('a confirmation mismatch is rejected without writing anything', async () => {
    const stub = stubDb();
    const service = new PasswordResetService(stub);

    await assert.rejects(
        () => service.setNewPassword(UUID, { password: PASSWORD, password2: 'different' }),
        /confirmation does not match/,
    );
    assert.strictEqual(stub.updates.length, 0, 'the database is untouched');
});

test('the legacy password3-only body is rejected without writing anything', async () => {
    const stub = stubDb();
    const service = new PasswordResetService(stub);

    await assert.rejects(() => service.setNewPassword(UUID, { password3: '$2b$10$fake-hash' }), TypeError);
    await assert.rejects(() => service.setNewPassword(UUID, { password3: 'PlainText123!' }), TypeError);
    assert.strictEqual(stub.updates.length, 0, 'password3 is ignored entirely');
});

test('empty or non-string passwords are rejected without writing anything', async () => {
    for (const password of [undefined, '', 123, ['a']]) {
        const stub = stubDb();
        const service = new PasswordResetService(stub);

        await assert.rejects(() => service.setNewPassword(UUID, { password }), TypeError);
        assert.strictEqual(stub.updates.length, 0);
    }
});

test('an old-client body (password + password3) hashes password and ignores password3', async () => {
    const stub = stubDb();
    const service = new PasswordResetService(stub);

    await service.setNewPassword(UUID, {
        password: PASSWORD,
        password2: PASSWORD,
        password3: '$2b$10$fake-hash-from-an-old-cached-client',
    });

    const stored = stub.updates[0][0].password;
    assert.strictEqual(await bcrypt.compare(PASSWORD, stored), true, 'the visible field is hashed');
    assert.notStrictEqual(stored, '$2b$10$fake-hash-from-an-old-cached-client');
    assert.strictEqual(
        await bcrypt.compare('$2b$10$fake-hash-from-an-old-cached-client', stored),
        false,
        'no double hash of password3',
    );
});

test('an invalid uuid is rejected without writing anything', async () => {
    for (const uuid of [undefined, null, '', 42]) {
        const stub = stubDb();
        const service = new PasswordResetService(stub);

        await assert.rejects(() => service.setNewPassword(uuid, { password: PASSWORD }), /UUID is required/);
        assert.strictEqual(stub.updates.length, 0);
    }
});
