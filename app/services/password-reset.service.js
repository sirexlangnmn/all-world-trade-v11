const bcrypt = require('bcrypt');

const db = require('../db_models');

// Match README.md §12.2 and CODE_REVIEW.md Finding 3. Existing hashes were
// created at cost 10 (the client-side hashing endpoint); bcrypt compares
// hashes of different costs without issue, so no rehash is needed.
const PASSWORD_HASH_ROUNDS = 12;

// bcrypt only consumes the first 72 bytes of its input. Rejecting longer
// secrets is more honest than silently truncating them: without this check a
// password and any longer value sharing its first 72 bytes would authenticate
// identically.
const MAX_PASSWORD_BYTES = 72;

function assertUserUuid(uuid) {
    if (typeof uuid !== 'string' || uuid.length === 0) {
        throw new TypeError('A user UUID is required');
    }
}

function assertPassword(password) {
    if (typeof password !== 'string' || password.length === 0) {
        throw new TypeError('Password must be a non-empty string');
    }

    if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
        throw new TypeError(`Password must not exceed ${MAX_PASSWORD_BYTES} bytes`);
    }
}

// `password2` is the confirmation field. It is optional (the reset form always
// sends it), but when present it must match. The confirmation itself is never
// hashed or stored.
function assertPasswordConfirmation(password, password2) {
    if (password2 !== undefined && password2 !== null && password2 !== password) {
        throw new TypeError('Password confirmation does not match');
    }
}

// The only place a password becomes a hash. Validation happens before bcrypt so
// empty or malformed input can never reach the database, and the caller never
// receives the hash back.
async function hashPassword(password) {
    assertPassword(password);

    return bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
}

class PasswordResetService {
    constructor(dbRef = db) {
        this.UsersAccounts = dbRef.users_accounts;
    }

    // Persist only a server-generated bcrypt hash. `silent: true` keeps the
    // legacy raw-SQL behaviour of not touching `updatedAt`.
    async persistPasswordHash(uuid, hashedPassword) {
        await this.UsersAccounts.update({ password: hashedPassword }, { where: { uuid }, silent: true });
    }

    async setNewPassword(uuid, { password, password2 } = {}) {
        assertUserUuid(uuid);
        assertPasswordConfirmation(password, password2);

        const hashedPassword = await hashPassword(password);

        await this.persistPasswordHash(uuid, hashedPassword);
    }
}

module.exports = {
    PasswordResetService,
    hashPassword,
    assertUserUuid,
    assertPassword,
    assertPasswordConfirmation,
    PASSWORD_HASH_ROUNDS,
    MAX_PASSWORD_BYTES,
};
