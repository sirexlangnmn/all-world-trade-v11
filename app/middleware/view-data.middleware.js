'use strict';

/**
 * Shared session/view-data construction for EJS page routes.
 *
 * Every builder returns a fresh object containing only whitelisted fields.
 * The raw session object and encrypted UUID strings are never transformed here.
 * Routes that need a non-standard shape use the named builder instead of
 * mutating a shared object.
 */

function buildIdentity(sessionUser) {
    return {
        uuid: sessionUser.uuid,
        type: sessionUser.type,
        first_name: sessionUser.first_name,
        last_name: sessionUser.last_name,
        email: sessionUser.email_or_social_media,
    };
}

/**
 * Guest/login shape: only the per-response CSP nonce.
 */
function buildLoginViewData(nonce) {
    return {
        ourGenerateNonce: nonce,
    };
}

/**
 * Guest shape used by pages that expect identity and location fields to exist
 * as empty strings rather than be absent.
 */
function buildAnonymousPageViewData(nonce) {
    return {
        uuid: '',
        type: '',
        first_name: '',
        last_name: '',
        email: '',
        country: '',
        state_or_province: '',
        ourGenerateNonce: nonce,
    };
}

/**
 * Standard authenticated shape: identity plus the per-response CSP nonce.
 */
function buildAuthenticatedViewData(sessionUser, nonce) {
    return {
        ...buildIdentity(sessionUser),
        ourGenerateNonce: nonce,
    };
}

/**
 * Authenticated shape for pages that also read location fields.
 */
function buildAuthenticatedViewDataWithLocation(sessionUser, nonce) {
    return {
        ...buildIdentity(sessionUser),
        country: sessionUser.country,
        state_or_province: sessionUser.state_or_province,
        ourGenerateNonce: nonce,
    };
}

/**
 * Authenticated shape used by routes that historically omit the nonce.
 */
function buildAuthenticatedViewDataWithoutNonce(sessionUser) {
    return buildIdentity(sessionUser);
}

/**
 * Public legal/pricing shape: null fields for guests (including `id`), and no
 * nonce for authenticated visitors.
 */
function buildOptionalSessionViewData(sessionUser, nonce) {
    if (sessionUser === undefined) {
        return {
            id: null,
            uuid: null,
            type: null,
            first_name: null,
            last_name: null,
            email: null,
            ourGenerateNonce: nonce,
        };
    }

    return buildIdentity(sessionUser);
}

/**
 * Support-profile shape: `type` is blank and `status` carries the account type;
 * the email comes from `email_address` instead of `email_or_social_media`.
 */
function buildSupportProfileViewData(sessionUser, nonce) {
    return {
        uuid: sessionUser.uuid,
        type: '',
        status: sessionUser.type,
        first_name: sessionUser.first_name,
        last_name: sessionUser.last_name,
        email: sessionUser.email_address,
        ourGenerateNonce: nonce,
    };
}

/**
 * Attach the common guest/authenticated data to the request. Routes that need a
 * different shape call the named builder directly. Must run after the session
 * and nonce middleware, and never creates a nonce of its own.
 */
function viewDataMiddleware(req, res, next) {
    const sessionUser = req.session ? req.session.user : undefined;
    const nonce = res.locals ? res.locals.cspNonce : undefined;

    req.viewData = sessionUser == null ? buildLoginViewData(nonce) : buildAuthenticatedViewData(sessionUser, nonce);

    next();
}

module.exports = {
    buildLoginViewData,
    buildAnonymousPageViewData,
    buildAuthenticatedViewData,
    buildAuthenticatedViewDataWithLocation,
    buildAuthenticatedViewDataWithoutNonce,
    buildOptionalSessionViewData,
    buildSupportProfileViewData,
    viewDataMiddleware,
};
