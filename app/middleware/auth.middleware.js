'use strict';

const ecdc = require('../shared/ecdc');
const db = require('../db_models');

const UNAUTHORIZED_BODY = Object.freeze({ status: 'error', message: 'Unauthorized' });

// Mounted with app.use('/api', isAuthenticated), so req.path is mount-relative
// (for example '/get/user'). Keep entries free of the '/api' prefix.
const PUBLIC_API_PATHS = new Set([
    '/post/login-process',
    '/post/help-and-support-login-process',
    '/post/forgot-password-process',
    '/post/create-reset-token',
    '/post/send-email-for-change-password',
    '/post/password-hashing',
    '/post/compare-password',
    '/post/email-verification',
    '/post/resend-email-verification',
    '/post/looking-for-small-scale-company-registration',
    '/post/looking-for-medium-scale-company-registration',
    '/post/looking-for-large-scale-company-registration',
    '/get/categories',
    '/get/region-of-operations',
    '/get/languages',
    '/get/trade-categories-for-today',
    '/v2/get/number-of-trader-members',
    '/v2/get/number-of-visitor-members',
    '/v2/post/registration-v2',
    '/v2/post/large-scale-company-registration',
    '/v2/post/medium-scale-company-registration',
    '/v2/post/small-scale-company-registration',
    '/v2/post/trader-scale-company-registration',
    '/v2/post/help-and-support-registration-process',
    '/v2/post/go-to-help-and-suggestion-page',
    '/v3/post/go-to-help-and-suggestion-page',
    '/v2/post/submit-email-if-help-and-suggest-link-not-available',
    '/v2/post/update-as-occupied',
]);

const PUBLIC_API_PATTERNS = Object.freeze([
    /^\/post\/registration(?:-|$)/, // registration-no-upload, registration-upload-*, registration-email-verification
    /^\/get\/sub-categories-by-trade-category-id\/[^/]+$/,
    /^\/get\/language-name-by-code\/[^/]+$/,
    /^\/get\/trade-category-title-by-id\/[^/]+$/,
    /^\/get\/sub-category-title-by-id\/[^/]+$/,
    /^\/get\/minor-sub-category-title-by-id\/[^/]+$/,
    /^\/get\/region-of-opertaion-by-iso\/[^/]+$/, // route spelling is intentionally 'opertaion'
    /^\/get\/minor-sub-categories-by-sub-category-id\/[^/]+$/,
    /^\/get\/minor-sub-categories-by-id\/[^/]+$/,
    /^\/get\/minor-sub-category-by-title\/[^/]+$/,
    /^\/get\/communicator-link\/[^/]+$/,
    /^\/post\/communicator-participants\/[^/]+\/[^/]+$/,
]);

function normalizeApiPath(apiPath) {
    if (typeof apiPath !== 'string' || apiPath.length === 0) return '';

    const withoutTrailingSlash = apiPath.length > 1 ? apiPath.replace(/\/+$/, '') : apiPath;

    return withoutTrailingSlash.toLowerCase();
}

function isPublicApiPath(apiPath) {
    const normalized = normalizeApiPath(apiPath);

    if (!normalized) return false;

    return PUBLIC_API_PATHS.has(normalized) || PUBLIC_API_PATTERNS.some((pattern) => pattern.test(normalized));
}

function getUserUuidFromSession(sessionUser, decryptUuid = ecdc.decryptUuid) {
    if (!sessionUser || typeof sessionUser.uuid !== 'string' || sessionUser.uuid.length === 0) return null;

    try {
        const uuid = decryptUuid(sessionUser.uuid);
        return typeof uuid === 'string' && uuid.length > 0 ? uuid : null;
    } catch (error) {
        return null;
    }
}

async function isUserLoggedIn(sessionUser, { usersAccounts = db.users_accounts, decryptUuid = ecdc.decryptUuid } = {}) {
    const uuid = getUserUuidFromSession(sessionUser, decryptUuid);

    if (!uuid) return false;

    try {
        const account = await usersAccounts.findOne({
            where: { uuid },
            attributes: ['login_status'],
            raw: true,
        });

        return Boolean(account) && Number(account.login_status) === 1;
    } catch (error) {
        console.error('User session lookup failed:', error.message);
        return false;
    }
}

function isSupportSession(sessionUser) {
    return Boolean(
        sessionUser &&
        Object.prototype.hasOwnProperty.call(sessionUser, 'email_address') &&
        !Object.prototype.hasOwnProperty.call(sessionUser, 'email_or_social_media'),
    );
}

async function isSupportLoggedIn(
    sessionUser,
    { supportAccounts = db.support_accounts, decryptUuid = ecdc.decryptUuid } = {},
) {
    if (!isSupportSession(sessionUser)) return false;

    const uuid = getUserUuidFromSession(sessionUser, decryptUuid);

    if (!uuid) return false;

    try {
        const account = await supportAccounts.findOne({
            where: { uuid },
            attributes: ['status'],
            raw: true,
        });

        return Boolean(account) && Number(account.status) === 1;
    } catch (error) {
        console.error('Support session lookup failed:', error.message);
        return false;
    }
}

async function isSessionActive(
    sessionUser,
    { usersAccounts = db.users_accounts, supportAccounts = db.support_accounts, decryptUuid = ecdc.decryptUuid } = {},
) {
    if (isSupportSession(sessionUser)) {
        return isSupportLoggedIn(sessionUser, { supportAccounts, decryptUuid });
    }

    return isUserLoggedIn(sessionUser, { usersAccounts, decryptUuid });
}

function createIsAuthenticated({
    usersAccounts = db.users_accounts,
    supportAccounts = db.support_accounts,
    decryptUuid = ecdc.decryptUuid,
} = {}) {
    return async function isAuthenticated(req, res, next) {
        if (req.method === 'OPTIONS') return next();

        if (isPublicApiPath(req.path)) return next();

        const sessionUser = req.session && req.session.user;
        const active = await isSessionActive(sessionUser, { usersAccounts, supportAccounts, decryptUuid });

        if (!active) return res.status(401).json(UNAUTHORIZED_BODY);

        return next();
    };
}

const isAuthenticated = createIsAuthenticated();

module.exports = {
    UNAUTHORIZED_BODY,
    PUBLIC_API_PATHS,
    PUBLIC_API_PATTERNS,
    normalizeApiPath,
    isPublicApiPath,
    getUserUuidFromSession,
    isUserLoggedIn,
    isSupportSession,
    isSupportLoggedIn,
    isSessionActive,
    createIsAuthenticated,
    isAuthenticated,
};
