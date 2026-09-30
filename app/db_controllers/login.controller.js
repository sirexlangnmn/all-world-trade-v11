const { validationResult } = require('express-validator');

const ecdc = require('../shared/ecdc');
const { AuthService } = require('../services/auth.service');

// Default service backed by the app's Sequelize models. The class accepts a db
// reference for dependency injection in tests.
const service = new AuthService();

// POST /api/post/login-process (public/assets/js/login.js serializes the form).
// Whitelist of the two fields the form actually sends; every other key in the
// body is dropped so it can never reach the query. The values are forwarded
// untouched -- the value the validation chain left in req.body is what the
// lookup key already was, and no trim/lowercase/normalizeEmail is introduced.
function mapLoginCredentials(body = {}) {
    return {
        email: body.loginEmailAddress,
        password: body.loginPassword,
    };
}

exports.mapLoginCredentials = mapLoginCredentials;

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

exports.buildSessionUser = buildSessionUser;

// Builds the route handler around a service, so the response branches can be
// exercised against a stub in tests without a database.
function createLoginHandler(authService) {
    return async function loginHandler(req, res) {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(200).send({ message: errors.array() });
        }

        // body-parser always installs an object, but the handler must not throw
        // a TypeError on a request that reached it with no body at all.
        const body = req.body || {};

        if (!body.loginEmailAddress || !body.loginPassword) {
            return res.send({ message: 'Please enter Username and Password!' });
        }

        try {
            const { ok, account } = await authService.authenticate(mapLoginCredentials(body));

            if (!ok) {
                return res.send({ message: 'Please check your email address and password' });
            }

            req.session.user = buildSessionUser(account);
            return res.send({ message: 'found' });
        } catch (error) {
            // Log server-side only. The database error message is never returned
            // to the client.
            console.error('Login failed:', error.message);
            return res.status(500).send({ message: 'Login failed.' });
        }
    };
}

exports.createLoginHandler = createLoginHandler;

exports.create = createLoginHandler(service);
