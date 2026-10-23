const bcrypt = require('bcrypt');

const db = require('../db_models');
const { getPhDateTimeString } = require('../utils/date.utils');
const { toScalar } = require('../utils/sanitize.utils');

// Columns needed to build the session payload. `password` is deliberately
// absent: the legacy query selected it here and then discarded it.
const PROFILE_ATTRIBUTES = Object.freeze(['uuid', 'email_or_social_media', 'type']);
const USER_ATTRIBUTES = Object.freeze(['first_name', 'last_name']);
const ADDRESS_ATTRIBUTES = Object.freeze(['country', 'state_or_province']);

// A real bcrypt hash (cost 10, matching every stored hash in users_accounts) of
// a random secret that was discarded immediately after generation, so nothing
// can ever match it.
//
// It exists to spend the same CPU on a non-existent account as on a wrong
// password. Without it, an unknown email returned in ~0.003 ms while a wrong
// password took ~55 ms -- a ~19000x timing oracle that let an attacker
// enumerate registered accounts even though the response text is identical.
// Comparing against this hash brings the two paths to within 1% of each other.
const ABSENT_ACCOUNT_HASH = '$2b$10$EyvzGDOq4WtkcC.D7Q88.eNpslTr4/kbSquQBMO2YvfDELbU1ny2O';

// Every rejection reason returns this exact object: no reason field, so the
// caller cannot distinguish "no such user" from "wrong password" from
// "no address row" by inspecting the result.
const REJECTED = Object.freeze({ ok: false });

// bcrypt is deliberately slow. A stored value that is not a bcrypt hash (for
// example a plaintext password left behind by the reset flow, CODE_REVIEW
// Finding 3) must read as "does not match" rather than crash the login path.
async function verifyPassword(plainPassword, hash) {
    if (typeof plainPassword !== 'string' || typeof hash !== 'string' || hash.length === 0) return false;

    try {
        return await bcrypt.compare(plainPassword, hash);
    } catch (error) {
        console.error('Password comparison failed:', error.message);
        return false;
    }
}

// Flatten the include-joined row into a plain object. Returns null when the
// joins produced nothing, i.e. the account has no `users` row.
function toAccountProfile(row) {
    if (!row || !row.user) return null;

    return {
        uuid: row.uuid,
        email_or_social_media: row.email_or_social_media,
        type: row.type,
        first_name: row.user.first_name,
        last_name: row.user.last_name,
        country: row.address ? row.address.country : null,
        state_or_province: row.address ? row.address.state_or_province : null,
    };
}

class AuthService {
    constructor(dbRef = db) {
        this.sequelize = dbRef.sequelize;
        this.Users = dbRef.users;
        this.UsersAddress = dbRef.users_address;
        this.UsersAccounts = dbRef.users_accounts;
    }

    // The identifier is always a bound value, never SQL text.
    async findPasswordHashByEmail(email) {
        const account = await this.UsersAccounts.findOne({
            where: { email_or_social_media: email },
            attributes: ['password'],
            raw: true,
        });

        return account ? account.password : null;
    }

    // INNER semantics for both joins are preserved (`required: true`), so an
    // account with no `users` or `users_addresses` row yields null and the
    // caller reports the standard failure. The legacy code dereferenced
    // `res[0].uuid` before checking `res.length`, so that case used to throw a
    // TypeError inside a mysql2 callback and take the process down.
    //
    // `raw` is deliberately off: with `raw: true` Sequelize flattens the
    // includes into dotted keys ('user.first_name') instead of the nested
    // `row.user` / `row.address` that toAccountProfile reads.
    async findAccountProfileByEmail(email) {
        return this.UsersAccounts.findOne({
            where: { email_or_social_media: email },
            attributes: PROFILE_ATTRIBUTES,
            include: [
                { model: this.Users, as: 'user', required: true, attributes: USER_ATTRIBUTES },
                { model: this.UsersAddress, as: 'address', required: true, attributes: ADDRESS_ATTRIBUTES },
            ],
        });
    }

    // Both audit writes land together or not at all, so a half-written login
    // (a session row whose account still says logged out) cannot survive.
    async recordLogin(uuid) {
        // `login_at` must be stored as the Manila 'YYYY-MM-DD HH:mm:ss' wall
        // clock, byte-for-byte: app/services/analytics.service.js compares it
        // against Manila range strings, and GET /logout writes `logout_at` the
        // same way.
        //
        // It therefore cannot go through `User_sessions.create`. `login_at` is
        // declared Sequelize.DATE, and Sequelize re-parses a string value into
        // an instant using the server's local offset (this host runs at
        // +08:00), so '2026-09-30 19:45:57' would be stored as
        // '2026-09-30 11:45:57' -- eight hours early, silently under-counting
        // the nightly report. A bound INSERT stores the string verbatim, exactly
        // like the statement it replaces.
        const loginAt = getPhDateTimeString(new Date());
        const transaction = await this.sequelize.transaction();

        try {
            // `user_id` is the plaintext UUID, which is what GET /logout matches.
            await this.sequelize.query('INSERT INTO user_sessions (user_id, login_at) VALUES (:userId, :loginAt)', {
                replacements: { userId: uuid, loginAt },
                transaction,
            });
            await this.UsersAccounts.update({ login_status: 1 }, { where: { uuid }, transaction });
            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }

        return loginAt;
    }

    // The login use case. No `req`, no `res`, no `session` (CODE_REVIEW
    // Finding 40), and no logging of the identifier, the password, or the hash.
    async authenticate({ email, password } = {}) {
        const identifier = toScalar(email);
        if (identifier === undefined) return REJECTED;

        const hash = await this.findPasswordHashByEmail(identifier);

        // Always run a comparison, using the decoy hash when the account does
        // not exist, so both rejection paths cost the same wall-clock time.
        const passwordMatches = await verifyPassword(password, hash === null ? ABSENT_ACCOUNT_HASH : hash);
        if (hash === null || !passwordMatches) return REJECTED;

        const account = toAccountProfile(await this.findAccountProfileByEmail(identifier));
        if (!account) return REJECTED;

        // The user is authenticated at this point, so a failed audit write is
        // logged and swallowed rather than turned into a failed login.
        try {
            await this.recordLogin(account.uuid);
        } catch (error) {
            console.error('DB error while recording login:', error.message);
        }

        return { ok: true, account };
    }
}

module.exports = { AuthService, toScalar, verifyPassword, toAccountProfile, ABSENT_ACCOUNT_HASH };
