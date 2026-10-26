// Acceptance tests for docs/tasks/006-No-Authentication-Middleware-on-API-Routes.md
// (CODE_REVIEW Finding 6 -- unauthenticated API routes).
//
// Run: node --test test/006-auth-middleware.test.js
//
// The middleware is exercised over HTTP on an ephemeral Express app with stub
// Sequelize models, so no database connection is required.
const { test } = require('node:test');
const assert = require('node:assert');
const { once } = require('node:events');
const express = require('express');

require('dotenv').config();

const {
    UNAUTHORIZED_BODY,
    isPublicApiPath,
    normalizeApiPath,
    isSupportSession,
    getUserUuidFromSession,
    isUserLoggedIn,
    createIsAuthenticated,
} = require('../app/middleware/auth.middleware.js');

const GOOD_CIPHER = 'good-cipher';
const GOOD_UUID = 'user-uuid-1';
const SUPPORT_CIPHER = 'support-cipher';
const SUPPORT_UUID = 'support-uuid-1';

function decrypt(cipher) {
    if (cipher === GOOD_CIPHER) return GOOD_UUID;
    if (cipher === SUPPORT_CIPHER) return SUPPORT_UUID;
    throw new Error('cannot decrypt');
}

function makeUsersAccountsStub(loginStatus = 1) {
    const calls = [];

    return {
        calls,
        findOne: async (options) => {
            calls.push(options);

            if (loginStatus === 'throw') throw new Error('database unavailable');

            if (loginStatus === 'missing') return null;

            return { login_status: loginStatus };
        },
    };
}

function makeSupportAccountsStub(status = 1) {
    const calls = [];

    return {
        calls,
        findOne: async (options) => {
            calls.push(options);

            if (status === 'throw') throw new Error('database unavailable');

            if (status === 'missing') return null;

            return { status };
        },
    };
}

function makeSessionMiddleware(sessionUser) {
    return (req, res, next) => {
        if (sessionUser !== undefined) req.session = { user: sessionUser };

        next();
    };
}

async function withServer(middleware, sessionUser, run) {
    const app = express();
    app.use(makeSessionMiddleware(sessionUser));
    app.use('/api', middleware);
    app.use('/api', (req, res) => res.status(200).json({ reached: true }));

    const server = app.listen(0);
    await once(server, 'listening');

    try {
        await run(`http://127.0.0.1:${server.address().port}`);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

function request(base, path = '/api/get/user', options = {}) {
    return fetch(`${base}${path}`, { method: 'POST', ...options });
}

test('public API paths are recognized', () => {
    const publicPaths = [
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
        '/post/registration-no-upload',
        '/post/registration-upload-company-logo',
        '/post/registration-email-verification',
        '/get/sub-categories-by-trade-category-id/1',
        '/get/language-name-by-code/en',
        '/get/trade-category-title-by-id/1',
        '/get/sub-category-title-by-id/1',
        '/get/minor-sub-category-title-by-id/1',
        '/get/region-of-opertaion-by-iso/PH',
        '/get/minor-sub-categories-by-sub-category-id/1',
        '/get/minor-sub-categories-by-id/1',
        '/get/minor-sub-category-by-title/title',
        '/get/communicator-link/room-1',
        '/post/communicator-participants/2/room-1',
    ];

    for (const apiPath of publicPaths) {
        assert.strictEqual(isPublicApiPath(apiPath), true, `${apiPath} should be public`);
    }
});

test('protected API paths are not public', () => {
    const protectedPaths = [
        '/get/user',
        '/get/users-account',
        '/get/users-address',
        '/get/users-business',
        '/get/company-details',
        '/get/business-location-code',
        '/get/users-logo-and-banners',
        '/get/companies',
        '/post/selection-search-parameter',
        '/post/update-company-details',
        '/post/update-small-scale-company',
        '/post/update-large-scale-company',
        '/post/upgrade-to-traders',
        '/post/emails/introduction',
        '/post/emails/notify-trader-on-client-contact',
        '/post/email-payment-account',
        '/v3/post/submit-client-email-to-the-trader',
        '/v2/get/traders-data',
        '/v2/get/latest-users',
        '/v2/export/users-businesses',
        '/v2/post/ec',
        '/v2/post/dc',
        '/v2/update/update-company-details',
        '/v2/update/region-of-operation',
        '/v2/get/create-help-and-support-communicator-link',
        '/v2/post/generate-waiting-room',
        '/v2/post/check-if-trader-is-active',
        '/post/upgrade-upload-company-video-only',
    ];

    for (const apiPath of protectedPaths) {
        assert.strictEqual(isPublicApiPath(apiPath), false, `${apiPath} should be protected`);
    }
});

test('path normalization handles trailing slashes and casing', () => {
    assert.strictEqual(normalizeApiPath('/GET/CATEGORIES/'), '/get/categories');
    assert.strictEqual(normalizeApiPath('/get/user///'), '/get/user');
    assert.strictEqual(normalizeApiPath(''), '');
    assert.strictEqual(normalizeApiPath(undefined), '');
    assert.strictEqual(isPublicApiPath('/GET/CATEGORIES/'), true);
    assert.strictEqual(isPublicApiPath('/GET/USER/'), false);
});

test('support session shape is distinguished from a normal session', () => {
    assert.strictEqual(isSupportSession({ uuid: 'x', email_address: 'agent@example.com', status: 1 }), true);
    assert.strictEqual(isSupportSession({ uuid: 'x', email_or_social_media: 'user@example.com', type: 1 }), false);
    assert.strictEqual(isSupportSession(null), false);
    assert.strictEqual(isSupportSession(undefined), false);
});

test('UUID extraction fails closed on missing and undecryptable values', () => {
    assert.strictEqual(getUserUuidFromSession(undefined, decrypt), null);
    assert.strictEqual(getUserUuidFromSession({}, decrypt), null);
    assert.strictEqual(getUserUuidFromSession({ uuid: '' }, decrypt), null);
    assert.strictEqual(getUserUuidFromSession({ uuid: 123 }, decrypt), null);
    assert.strictEqual(getUserUuidFromSession({ uuid: 'bad' }, decrypt), null);
    assert.strictEqual(getUserUuidFromSession({ uuid: GOOD_CIPHER }, decrypt), GOOD_UUID);
});

test('regular login status only accepts the numeric value 1', async () => {
    for (const accepted of [1, '1']) {
        const usersAccounts = makeUsersAccountsStub(accepted);
        assert.strictEqual(await isUserLoggedIn({ uuid: GOOD_CIPHER }, { usersAccounts, decryptUuid: decrypt }), true);
    }

    for (const rejected of [0, '0', null, 'missing', 2, '2']) {
        const usersAccounts = makeUsersAccountsStub(rejected);
        assert.strictEqual(await isUserLoggedIn({ uuid: GOOD_CIPHER }, { usersAccounts, decryptUuid: decrypt }), false);
    }
});

test('a public path with no session reaches the handler without touching the database', async () => {
    const usersAccounts = makeUsersAccountsStub(1);
    const supportAccounts = makeSupportAccountsStub(1);
    const middleware = createIsAuthenticated({ usersAccounts, supportAccounts, decryptUuid: decrypt });

    await withServer(middleware, undefined, async (base) => {
        const response = await request(base, '/api/get/categories', { method: 'GET' });

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(await response.json(), { reached: true });
        assert.strictEqual(usersAccounts.calls.length, 0);
        assert.strictEqual(supportAccounts.calls.length, 0);
    });
});

test('a protected path with no session returns 401 and never reaches the handler', async () => {
    const usersAccounts = makeUsersAccountsStub(1);
    const supportAccounts = makeSupportAccountsStub(1);
    const middleware = createIsAuthenticated({ usersAccounts, supportAccounts, decryptUuid: decrypt });

    await withServer(middleware, undefined, async (base) => {
        const response = await request(base);

        assert.strictEqual(response.status, 401);
        assert.deepStrictEqual(await response.json(), UNAUTHORIZED_BODY);
        assert.strictEqual(usersAccounts.calls.length, 0);
        assert.strictEqual(supportAccounts.calls.length, 0);
    });
});

test('an active normal session reaches a protected route', async () => {
    const usersAccounts = makeUsersAccountsStub(1);
    const supportAccounts = makeSupportAccountsStub(1);
    const middleware = createIsAuthenticated({ usersAccounts, supportAccounts, decryptUuid: decrypt });

    await withServer(middleware, { uuid: GOOD_CIPHER, email_or_social_media: 'user@example.com' }, async (base) => {
        const response = await request(base);

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(await response.json(), { reached: true });
        assert.strictEqual(usersAccounts.calls.length, 1);
        assert.strictEqual(supportAccounts.calls.length, 0);
        assert.deepStrictEqual(usersAccounts.calls[0].where, { uuid: GOOD_UUID });
        assert.deepStrictEqual(usersAccounts.calls[0].attributes, ['login_status']);
        assert.strictEqual(usersAccounts.calls[0].raw, true);
    });
});

test('inactive or unknown normal sessions are rejected', async () => {
    for (const loginStatus of [0, '0', null, 'missing', 2]) {
        const usersAccounts = makeUsersAccountsStub(loginStatus);
        const supportAccounts = makeSupportAccountsStub(1);
        const middleware = createIsAuthenticated({ usersAccounts, supportAccounts, decryptUuid: decrypt });

        await withServer(middleware, { uuid: GOOD_CIPHER, email_or_social_media: 'user@example.com' }, async (base) => {
            const response = await request(base);

            assert.strictEqual(response.status, 401, `login_status ${String(loginStatus)} must be rejected`);
            assert.deepStrictEqual(await response.json(), UNAUTHORIZED_BODY);
        });
    }
});

test('malformed sessions and decryption failures are rejected without throwing', async () => {
    const sessions = [
        {},
        { uuid: '' },
        { uuid: 'not-a-cipher' },
        { uuid: 12345 },
        { email_or_social_media: 'user@example.com' },
    ];

    for (const sessionUser of sessions) {
        const usersAccounts = makeUsersAccountsStub(1);
        const supportAccounts = makeSupportAccountsStub(1);
        const middleware = createIsAuthenticated({ usersAccounts, supportAccounts, decryptUuid: decrypt });

        await withServer(middleware, sessionUser, async (base) => {
            const response = await request(base);

            assert.strictEqual(response.status, 401, `${JSON.stringify(sessionUser)} must be rejected`);
            assert.deepStrictEqual(await response.json(), UNAUTHORIZED_BODY);
        });
    }
});

test('a database failure fails closed with 401 and no sensitive details', async () => {
    const usersAccounts = makeUsersAccountsStub('throw');
    const supportAccounts = makeSupportAccountsStub(1);
    const middleware = createIsAuthenticated({ usersAccounts, supportAccounts, decryptUuid: decrypt });
    const sessionUser = { uuid: GOOD_CIPHER, email_or_social_media: 'private@example.com' };

    const originalError = console.error;
    const logged = [];
    console.error = (...args) => logged.push(args.join(' '));

    try {
        await withServer(middleware, sessionUser, async (base) => {
            const response = await request(base);
            const body = await response.text();

            assert.strictEqual(response.status, 401);
            assert.deepStrictEqual(JSON.parse(body), UNAUTHORIZED_BODY);
            assert.ok(!body.includes(GOOD_CIPHER));
            assert.ok(!body.includes(GOOD_UUID));
            assert.ok(!body.includes('private@example.com'));
            assert.ok(!logged.join(' ').includes(GOOD_CIPHER));
            assert.ok(!logged.join(' ').includes(GOOD_UUID));
            assert.ok(!logged.join(' ').includes('private@example.com'));
        });
    } finally {
        console.error = originalError;
    }
});

test('an active support session validates against support_accounts only', async () => {
    const usersAccounts = makeUsersAccountsStub(1);
    const supportAccounts = makeSupportAccountsStub(1);
    const middleware = createIsAuthenticated({ usersAccounts, supportAccounts, decryptUuid: decrypt });
    const sessionUser = { uuid: SUPPORT_CIPHER, email_address: 'agent@example.com', status: 1 };

    await withServer(middleware, sessionUser, async (base) => {
        const response = await request(base, '/api/v2/get/create-help-and-support-communicator-link');

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(await response.json(), { reached: true });
        assert.strictEqual(usersAccounts.calls.length, 0);
        assert.strictEqual(supportAccounts.calls.length, 1);
        assert.deepStrictEqual(supportAccounts.calls[0].where, { uuid: SUPPORT_UUID });
        assert.deepStrictEqual(supportAccounts.calls[0].attributes, ['status']);
        assert.strictEqual(supportAccounts.calls[0].raw, true);
    });
});

test('inactive or unknown support sessions are rejected', async () => {
    for (const status of [0, '0', null, 'missing', 2]) {
        const usersAccounts = makeUsersAccountsStub(1);
        const supportAccounts = makeSupportAccountsStub(status);
        const middleware = createIsAuthenticated({ usersAccounts, supportAccounts, decryptUuid: decrypt });
        const sessionUser = { uuid: SUPPORT_CIPHER, email_address: 'agent@example.com', status };

        await withServer(middleware, sessionUser, async (base) => {
            const response = await request(base);

            assert.strictEqual(response.status, 401, `support status ${String(status)} must be rejected`);
            assert.strictEqual(usersAccounts.calls.length, 0);
        });
    }
});

test('a failing support lookup fails closed', async () => {
    const usersAccounts = makeUsersAccountsStub(1);
    const supportAccounts = makeSupportAccountsStub('throw');
    const middleware = createIsAuthenticated({ usersAccounts, supportAccounts, decryptUuid: decrypt });
    const sessionUser = { uuid: SUPPORT_CIPHER, email_address: 'agent@example.com', status: 1 };

    const originalError = console.error;
    console.error = () => {};

    try {
        await withServer(middleware, sessionUser, async (base) => {
            const response = await request(base);

            assert.strictEqual(response.status, 401);
            assert.strictEqual(usersAccounts.calls.length, 0);
        });
    } finally {
        console.error = originalError;
    }
});

test('CORS preflight requests pass through without a session or database lookup', async () => {
    const usersAccounts = makeUsersAccountsStub(1);
    const supportAccounts = makeSupportAccountsStub(1);
    const middleware = createIsAuthenticated({ usersAccounts, supportAccounts, decryptUuid: decrypt });

    await withServer(middleware, undefined, async (base) => {
        const response = await request(base, '/api/get/user', { method: 'OPTIONS' });

        assert.strictEqual(response.status, 200);
        assert.strictEqual(usersAccounts.calls.length, 0);
        assert.strictEqual(supportAccounts.calls.length, 0);
    });
});
