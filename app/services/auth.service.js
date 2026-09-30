const bcrypt = require('bcrypt');

const db = require('../db_models');
const { getPhDateTimeString } = require('../utils/date.utils');

// Columns the legacy raw SQL (app/models/login.model.js) selected for the
// session payload. `password` is deliberately absent: the second query used to
// SELECT it and then throw it away.
const PROFILE_ATTRIBUTES = Object.freeze(['uuid', 'email_or_social_media', 'type']);

const USER_ATTRIBUTES = Object.freeze(['first_name', 'last_name']);

const ADDRESS_ATTRIBUTES = Object.freeze(['country', 'state_or_province']);

// Coerce a request-supplied value into a scalar that is safe to bind. Strings
// pass through byte-for-byte unchanged (no trim, no toLowerCase, no email
// normalization -- that would change the lookup key). Numbers/booleans are
// stringified. Objects and arrays are dropped so a Sequelize operator
// ({ [Op.ne]: null }) or an array can never be smuggled in as a value.
// Mirrors toScalar() in app/services/business-search.service.js.
function toScalar(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return undefined;
}

// bcrypt is deliberately slow; a stored value that is not a bcrypt hash (for
// example a plaintext password left behind by the reset flow, CODE_REVIEW
// Finding 3) must be treated as "does not match" rather than crashing the login
// path. bcrypt.compare already returns false for those, so the try/catch is
// belt-and-braces.
async function verifyPassword(plainPassword, hash) {
    if (typeof hash !== 'string' || hash.length === 0) return false;
    if (typeof plainPassword !== 'string') return false;
    try {
        return await bcrypt.compare(plainPassword, hash);
    } catch (error) {
        console.error('Password comparison failed:', error.message);
        return false;
    }
}

class AuthService {
    constructor(dbRef = db) {
        this.db = dbRef;
        this.sequelize = dbRef.sequelize;
        this.UsersAccounts = dbRef.users_accounts;
    }

    // Parameterized lookup: the identifier is a bound value, never SQL text.
    async findPasswordHashByEmail(email) {
        const account = await this.UsersAccounts.findOne({
            where: { email_or_social_media: email },
            attributes: ['password'],
            raw: true,
        });
        return account ? account.password : null;
    }

    // Parameterized replacement for the legacy
    // `users_accounts INNER JOIN users INNER JOIN users_addresses` query.
    // The identifier is still a bound value. INNER semantics for both joins
    // are preserved (`required: true`): an account without a `users` or
    // `users_addresses` row yields null, which the caller reports as the
    // standard failure. The legacy code dereferenced `res[0].uuid` before
    // checking `res.length`, so this case used to throw a TypeError inside a
    // mysql2 callback and take the process down.
    //
    // `raw` is deliberately left off: with `raw: true` Sequelize flattens the
    // included rows into dotted keys ('user.first_name') instead of the nested
    // `row.user` / `row.address` that toAccountProfile reads.
    async findAccountProfileByEmail(email) {
        return this.UsersAccounts.findOne({
            where: { email_or_social_media: email },
            attributes: PROFILE_ATTRIBUTES,
            include: [
                {
                    model: this.db.users,
                    as: 'user',
                    required: true,
                    attributes: USER_ATTRIBUTES,
                },
                {
                    model: this.db.users_address,
                    as: 'address',
                    required: true,
                    attributes: ADDRESS_ATTRIBUTES,
                },
            ],
        });
    }

    // Flatten the include-joined row into the plain object the controller turns
    // into a session. Returns null when the joins produced nothing.
    toAccountProfile(row) {
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

    // Audit writes performed on a successful login.
    //
    // `login_at` must be stored as the Manila-local 'YYYY-MM-DD HH:mm:ss' wall
    // clock, byte-for-byte, because app/services/analytics.service.js compares
    // it against Manila wall-clock range strings and app/src/server.js's
    // GET /logout writes `logout_at` the same way.
    //
    // It therefore cannot go through `User_sessions.create`: `login_at` is
    // declared Sequelize.DATE, and Sequelize re-parses a string value into an
    // instant using the server's local offset (this host runs at +08:00), so a
    // '2026-09-30 19:45:57' string is stored as '2026-09-30 11:45:57' -- eight
    // hours early, which would silently under-count the nightly report. A
    // parameterized INSERT writes the string verbatim, exactly like the
    // statement it replaces, while still binding both values.
    //
    // `user_id` is the plaintext UUID, which is what GET /logout matches on.
    async recordLogin(uuid) {
        const loginAt = getPhDateTimeString(new Date());

        await this.sequelize.query('INSERT INTO user_sessions (user_id, login_at) VALUES (:userId, :loginAt)', {
            replacements: { userId: uuid, loginAt },
        });

        // login_status is a plain integer column, so the model call is safe and
        // additionally maintains `updatedAt`.
        await this.UsersAccounts.update({ login_status: 1 }, { where: { uuid } });

        return loginAt;
    }

    // The login use case. One failure shape for every rejection reason: the
    // caller cannot tell "no such user" from "wrong password" from "no address
    // row" without inspecting something that is not there.
    //
    // No `req`, no `res`, no `session` (CODE_REVIEW Finding 40), and no
    // logging of the identifier, the password, or the stored hash.
    async authenticate({ email, password } = {}) {
        const identifier = toScalar(email);

        if (identifier === undefined) return { ok: false };

        const hash = await this.findPasswordHashByEmail(identifier);
        if (hash === null) return { ok: false };

        if (!(await verifyPassword(password, hash))) return { ok: false };

        const account = this.toAccountProfile(await this.findAccountProfileByEmail(identifier));
        if (!account) return { ok: false };

        // The user is authenticated at this point, so an audit-write failure
        // is logged and swallowed rather than turned into a failed login.
        try {
            await this.recordLogin(account.uuid);
        } catch (error) {
            console.error('DB error while recording login:', error.message);
        }

        return { ok: true, account };
    }
}

module.exports = { AuthService, toScalar, verifyPassword };
