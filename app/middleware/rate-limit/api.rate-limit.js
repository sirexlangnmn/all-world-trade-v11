'use strict';

const { rateLimit } = require('express-rate-limit');

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const GENERAL_API_LIMIT = 100;
const AUTH_LIMIT = 5;

const RATE_LIMIT_JSON_MESSAGE = {
    status: 'error',
    message: 'Too many requests. Please try again later.',
};

function createApiRateLimiter({
    windowMs = FIFTEEN_MINUTES_MS,
    limit = GENERAL_API_LIMIT,
    message = RATE_LIMIT_JSON_MESSAGE,
} = {}) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        statusCode: 429,
        message,
        skip: (req) => req.method === 'OPTIONS',
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
    });
}

const generalApiLimiter = createApiRateLimiter();
const loginLimiter = createApiRateLimiter({ limit: AUTH_LIMIT });
const supportLoginLimiter = createApiRateLimiter({ limit: AUTH_LIMIT });

module.exports = {
    FIFTEEN_MINUTES_MS,
    GENERAL_API_LIMIT,
    AUTH_LIMIT,
    RATE_LIMIT_JSON_MESSAGE,
    createApiRateLimiter,
    generalApiLimiter,
    loginLimiter,
    supportLoginLimiter,
};
