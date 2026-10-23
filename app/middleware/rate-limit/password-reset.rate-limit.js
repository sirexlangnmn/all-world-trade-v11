'use strict';

const { rateLimit } = require('express-rate-limit');

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const STRICT_LIMIT = 5;
const RESET_PAGE_LIMIT = 30;

const RATE_LIMIT_JSON_MESSAGE = {
    status: 'error',
    message: 'Too many requests. Please try again later.',
};
const RATE_LIMIT_TEXT_MESSAGE = 'Too many requests. Please try again later.';

function createPasswordResetRateLimiter({
    windowMs = FIFTEEN_MINUTES_MS,
    limit = STRICT_LIMIT,
    message = RATE_LIMIT_JSON_MESSAGE,
} = {}) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        statusCode: 429,
        message,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
    });
}

const forgotPasswordProcessLimiter = createPasswordResetRateLimiter();
const createResetTokenLimiter = createPasswordResetRateLimiter();
const sendResetEmailLimiter = createPasswordResetRateLimiter();
const resetPasswordPageLimiter = createPasswordResetRateLimiter({
    limit: RESET_PAGE_LIMIT,
    message: RATE_LIMIT_TEXT_MESSAGE,
});
const resetPasswordSubmitLimiter = createPasswordResetRateLimiter();

module.exports = {
    FIFTEEN_MINUTES_MS,
    STRICT_LIMIT,
    RESET_PAGE_LIMIT,
    RATE_LIMIT_JSON_MESSAGE,
    RATE_LIMIT_TEXT_MESSAGE,
    createPasswordResetRateLimiter,
    forgotPasswordProcessLimiter,
    createResetTokenLimiter,
    sendResetEmailLimiter,
    resetPasswordPageLimiter,
    resetPasswordSubmitLimiter,
};
