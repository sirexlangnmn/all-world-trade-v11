const { validationResult } = require('express-validator');

const ecdc = require('../shared/ecdc');
const { AuthService } = require('../services/auth.service');

// POST /api/post/login-process (public/assets/js/login.js serializes the form).
//
// The response contract is frozen by docs/tasks/002-fix-sql-injection-login.md
// and must not drift: `login.js` has no `error:` handler, so the two failure
// paths have to stay on HTTP 200 or the SweetAlert never fires. Keeping the
// messages here makes that contract a single named thing rather than string
// literals scattered through the handler.
const MESSAGES = Object.freeze({
    // HTTP 200 -- validation middleware rejected the input.
    invalid: 'Please enter Username and Password!',
    // HTTP 200 -- every authentication failure, indistinguishable by design.
    rejected: 'Please check your email address and password',
    // HTTP 200 -- client redirects to /selection.
    found: 'found',
    // HTTP 500 -- deliberately generic; never leak error.message.
    serverError: 'Login failed.',
});

// Whitelist of the two fields the form actually sends. Every other key in the
// body is dropped so it can never reach the query. Values are forwarded
// untouched -- the lookup key depends on the exact bytes submitted, so no
// trim / toLowerCase / normalizeEmail is introduced.
function mapLoginCredentials(body) {
    const source = body && typeof body === 'object' ? body : {};

    return {
        email: source.loginEmailAddress,
        password: source.loginPassword,
    };
}

// The seven session keys the rest of the app reads off req.session.user
// (app/src/server.js page routes, GET /logout, selection.controller, ...).
// `uuid` is CryptoJS-AES ciphertext keyed with JWT_SECRET, exactly as before,
// so sessions issued by the previous build keep working.
function buildSessionUser(account) {
    return {
        uuid: ecdc.encryptUuid(account.uuid),
        email_or_social_media: account.email_or_social_media,
        type: account.type,
        first_name: account.first_name,
        last_name: account.last_name,
        country: account.country,
        state_or_province: account.state_or_province,
    };
}

// Builds the route handler around a service, so the response branches can be
// exercised against a stub in tests without a database.
function createLoginHandler(authService) {
    return async function loginHandler(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(200).send({ message: errors.array() });

        const credentials = mapLoginCredentials(req.body);
        if (!credentials.email || !credentials.password) {
            return res.status(200).send({ message: MESSAGES.invalid });
        }

        try {
            const { ok, account } = await authService.authenticate(credentials);

            if (!ok) return res.status(200).send({ message: MESSAGES.rejected });

            req.session.user = buildSessionUser(account);
            return res.status(200).send({ message: MESSAGES.found });
        } catch (error) {
            // Server-side only. The database error message never reaches the
            // client.
            console.error('Login failed:', error.message);
            return res.status(500).send({ message: MESSAGES.serverError });
        }
    };
}

module.exports = {
    MESSAGES,
    mapLoginCredentials,
    buildSessionUser,
    createLoginHandler,
    // Default service, backed by the app's Sequelize models.
    create: createLoginHandler(new AuthService()),
};
