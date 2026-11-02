'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
    buildLoginViewData,
    buildAnonymousPageViewData,
    buildAuthenticatedViewData,
    buildAuthenticatedViewDataWithLocation,
    buildAuthenticatedViewDataWithoutNonce,
    buildOptionalSessionViewData,
    buildSupportProfileViewData,
    viewDataMiddleware,
} = require('../app/middleware/view-data.middleware.js');

const sessionUser = {
    uuid: 'encrypted-uuid',
    type: 3,
    first_name: 'First',
    last_name: 'Last',
    email_or_social_media: 'user@example.com',
    country: 'PH',
    state_or_province: 'Metro Manila',
};

function runMiddleware(session, nonce = 'test-nonce') {
    const req = { session };
    const res = { locals: { cspNonce: nonce } };
    let called = false;

    viewDataMiddleware(req, res, () => {
        called = true;
    });

    assert.equal(called, true);
    return req;
}

test('buildLoginViewData exposes only the nonce', () => {
    assert.deepEqual(buildLoginViewData('nonce-1'), { ourGenerateNonce: 'nonce-1' });
});

test('buildAnonymousPageViewData keeps empty-string identity and location fields', () => {
    assert.deepEqual(buildAnonymousPageViewData('nonce-1'), {
        uuid: '',
        type: '',
        first_name: '',
        last_name: '',
        email: '',
        country: '',
        state_or_province: '',
        ourGenerateNonce: 'nonce-1',
    });
});

test('buildAuthenticatedViewData maps email_or_social_media to email', () => {
    assert.deepEqual(buildAuthenticatedViewData(sessionUser, 'nonce-1'), {
        uuid: 'encrypted-uuid',
        type: 3,
        first_name: 'First',
        last_name: 'Last',
        email: 'user@example.com',
        ourGenerateNonce: 'nonce-1',
    });
});

test('buildAuthenticatedViewDataWithLocation preserves country and state', () => {
    assert.deepEqual(buildAuthenticatedViewDataWithLocation(sessionUser, 'nonce-1'), {
        uuid: 'encrypted-uuid',
        type: 3,
        first_name: 'First',
        last_name: 'Last',
        email: 'user@example.com',
        country: 'PH',
        state_or_province: 'Metro Manila',
        ourGenerateNonce: 'nonce-1',
    });
});

test('buildAuthenticatedViewDataWithoutNonce omits the nonce', () => {
    const data = buildAuthenticatedViewDataWithoutNonce(sessionUser);

    assert.deepEqual(data, {
        uuid: 'encrypted-uuid',
        type: 3,
        first_name: 'First',
        last_name: 'Last',
        email: 'user@example.com',
    });
    assert.equal('ourGenerateNonce' in data, false);
});

test('buildOptionalSessionViewData keeps the null guest shape and nonce omission', () => {
    assert.deepEqual(buildOptionalSessionViewData(undefined, 'nonce-1'), {
        id: null,
        uuid: null,
        type: null,
        first_name: null,
        last_name: null,
        email: null,
        ourGenerateNonce: 'nonce-1',
    });

    assert.deepEqual(buildOptionalSessionViewData(sessionUser, 'nonce-1'), {
        uuid: 'encrypted-uuid',
        type: 3,
        first_name: 'First',
        last_name: 'Last',
        email: 'user@example.com',
    });
});

test('buildSupportProfileViewData uses status and email_address', () => {
    assert.deepEqual(
        buildSupportProfileViewData(
            {
                uuid: 'support-uuid',
                type: 5,
                first_name: 'Support',
                last_name: 'Agent',
                email_address: 'support@example.com',
                email_or_social_media: 'ignored@example.com',
            },
            'nonce-1',
        ),
        {
            uuid: 'support-uuid',
            type: '',
            status: 5,
            first_name: 'Support',
            last_name: 'Agent',
            email: 'support@example.com',
            ourGenerateNonce: 'nonce-1',
        },
    );
});

test('viewDataMiddleware attaches guest data using res.locals.cspNonce', () => {
    const req = runMiddleware({}, 'guest-nonce');

    assert.deepEqual(req.viewData, { ourGenerateNonce: 'guest-nonce' });
});

test('viewDataMiddleware attaches authenticated data for a session user', () => {
    const req = runMiddleware({ user: sessionUser }, 'auth-nonce');

    assert.deepEqual(req.viewData, {
        uuid: 'encrypted-uuid',
        type: 3,
        first_name: 'First',
        last_name: 'Last',
        email: 'user@example.com',
        ourGenerateNonce: 'auth-nonce',
    });
});

test('viewDataMiddleware handles a missing session object as a guest', () => {
    const req = runMiddleware(undefined, 'guest-nonce');

    assert.deepEqual(req.viewData, { ourGenerateNonce: 'guest-nonce' });
});

test('viewDataMiddleware handles a null session user as a guest', () => {
    const req = runMiddleware({ user: null }, 'guest-nonce');

    assert.deepEqual(req.viewData, { ourGenerateNonce: 'guest-nonce' });
});

test('viewDataMiddleware creates a fresh object per request and does not mutate the session', () => {
    const before = { ...sessionUser };
    const first = runMiddleware({ user: sessionUser }, 'nonce-1').viewData;
    const second = runMiddleware({ user: sessionUser }, 'nonce-2').viewData;

    assert.notEqual(first, second);
    assert.notEqual(first, sessionUser);
    assert.deepEqual(sessionUser, before);

    first.uuid = 'changed';
    assert.equal(second.uuid, 'encrypted-uuid');
    assert.equal(sessionUser.uuid, 'encrypted-uuid');
});

test('builders return a fresh object on every call', () => {
    const first = buildAuthenticatedViewData(sessionUser, 'nonce-1');
    const second = buildAuthenticatedViewData(sessionUser, 'nonce-1');

    assert.notEqual(first, second);
    assert.deepEqual(first, second);

    first.uuid = 'changed';
    assert.equal(second.uuid, 'encrypted-uuid');
    assert.equal(sessionUser.uuid, 'encrypted-uuid');
});

test('view data only exposes whitelisted identity fields', () => {
    const sensitiveUser = {
        ...sessionUser,
        password: '$2b$12$hash',
        reset_token: 'secret-token',
        login_status: 1,
    };

    const guestKeys = Object.keys(buildLoginViewData('nonce-1')).sort();
    const authKeys = Object.keys(buildAuthenticatedViewData(sensitiveUser, 'nonce-1')).sort();
    const locationKeys = Object.keys(buildAuthenticatedViewDataWithLocation(sensitiveUser, 'nonce-1')).sort();
    const noNonceKeys = Object.keys(buildAuthenticatedViewDataWithoutNonce(sensitiveUser)).sort();

    assert.deepEqual(guestKeys, ['ourGenerateNonce']);
    assert.deepEqual(authKeys, ['email', 'first_name', 'last_name', 'ourGenerateNonce', 'type', 'uuid']);
    assert.deepEqual(locationKeys, [
        'country',
        'email',
        'first_name',
        'last_name',
        'ourGenerateNonce',
        'state_or_province',
        'type',
        'uuid',
    ]);
    assert.deepEqual(noNonceKeys, ['email', 'first_name', 'last_name', 'type', 'uuid']);
    assert.equal('password' in buildAuthenticatedViewData(sensitiveUser, 'nonce-1'), false);
    assert.equal('reset_token' in buildAuthenticatedViewData(sensitiveUser, 'nonce-1'), false);
});

test('traders-page composition adds companyName without polluting other routes', () => {
    const companyName = 'example-company';

    assert.deepEqual(
        {
            ...buildAuthenticatedViewDataWithLocation(sessionUser, 'nonce-1'),
            companyName,
        },
        {
            uuid: 'encrypted-uuid',
            type: 3,
            first_name: 'First',
            last_name: 'Last',
            email: 'user@example.com',
            country: 'PH',
            state_or_province: 'Metro Manila',
            ourGenerateNonce: 'nonce-1',
            companyName,
        },
    );

    const standard = buildAuthenticatedViewDataWithLocation(sessionUser, 'nonce-1');
    assert.equal('companyName' in standard, false);
});

test('viewDataMiddleware does not create a nonce when locals has none', () => {
    const req = { session: { user: sessionUser } };
    const res = { locals: {} };

    viewDataMiddleware(req, res, () => {});

    assert.equal(req.viewData.ourGenerateNonce, undefined);
    assert.equal('ourGenerateNonce' in req.viewData, true);
});

test('viewDataMiddleware integrates with real Express dispatch', async () => {
    const express = require('express');
    const http = require('node:http');

    const app = express();
    app.use((req, res, next) => {
        req.session = req.headers['x-test-auth'] === 'yes' ? { user: sessionUser } : {};
        res.locals.cspNonce = 'express-nonce';
        next();
    });
    app.use(viewDataMiddleware);
    app.get('/page', (req, res) => res.json(req.viewData));

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
        const { port } = server.address();
        const baseUrl = `http://127.0.0.1:${port}/page`;

        const guest = await (await fetch(baseUrl)).json();
        assert.deepEqual(guest, { ourGenerateNonce: 'express-nonce' });

        const authenticated = await (await fetch(baseUrl, { headers: { 'x-test-auth': 'yes' } })).json();
        assert.deepEqual(authenticated, {
            uuid: 'encrypted-uuid',
            type: 3,
            first_name: 'First',
            last_name: 'Last',
            email: 'user@example.com',
            ourGenerateNonce: 'express-nonce',
        });
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});
