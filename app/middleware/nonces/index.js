'use strict';

const crypto = require('crypto');

const NONCE_BYTES = 16;

/**
 * Generate a cryptographically secure CSP nonce.
 *
 * Base64 is used because it is compact and only contains characters that are
 * safe inside both an HTML attribute and a CSP source expression.
 *
 * @returns {string}
 */
function createNonce() {
    return crypto.randomBytes(NONCE_BYTES).toString('base64');
}

/**
 * Create one nonce per response and expose it to Helmet (`req.cspNonce`) and to
 * EJS (`res.locals.cspNonce`). The nonce must never be reused across requests
 * because a reused nonce lets injected markup bypass `script-src`.
 */
function nonceMiddleware(req, res, next) {
    const nonce = createNonce();

    req.cspNonce = nonce;
    res.locals.cspNonce = nonce;

    next();
}

module.exports = {
    NONCE_BYTES,
    createNonce,
    nonceMiddleware,
};
