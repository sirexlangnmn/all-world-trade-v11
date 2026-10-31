const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const registerPublicPagesRoutes = require('../app/routes/pages/public-pages.routes.js');

function getRegisteredRoutes() {
    const routes = new Map();
    const app = {
        get(route, handler) {
            routes.set(Array.isArray(route) ? route[0] : route, handler);
        },
    };

    registerPublicPagesRoutes(app);
    return routes;
}

function renderFor(route, session, nonce = 'test-nonce') {
    const handler = getRegisteredRoutes().get(route);
    const renderCalls = [];
    const req = { session };
    const res = {
        locals: { cspNonce: nonce },
        render(...args) {
            renderCalls.push(args);
        },
    };

    handler(req, res);
    return renderCalls[0];
}

test('public page routes preserve their existing GET paths', () => {
    const routes = getRegisteredRoutes();

    assert.deepEqual(
        [...routes.keys()],
        [
            '/email-verification',
            '/login',
            '/help-and-support-login',
            '/terms-and-conditions',
            '/data-privacy-notice',
            '/cookie-policy',
            '/pricing',
            '/pricing2',
        ],
    );
});

test('verification and login pages preserve their existing view data', () => {
    const email = renderFor('/email-verification', { registration_email_address: 'user@example.com' });
    assert.deepEqual(email, [
        path.join(__dirname, '../public/view/verification/email-verification'),
        { registration_email_address: 'user@example.com' },
    ]);

    const login = renderFor('/login', {});
    assert.deepEqual(login, [
        path.join(__dirname, '../public/view/login/index'),
        { data: { ourGenerateNonce: 'test-nonce' } },
    ]);

    const supportLogin = renderFor('/help-and-support-login', {});
    assert.deepEqual(supportLogin, [path.join(__dirname, '../public/view/login/help-and-support-login')]);
});

test('legal and pricing pages retain guest and authenticated data shapes', () => {
    const views = [
        ['/terms-and-conditions', 'legal/terms-and-conditions'],
        ['/data-privacy-notice', 'legal/data-privacy-notice'],
        ['/cookie-policy', 'legal/cookie-policy'],
        ['/pricing', 'pricing/index'],
        ['/pricing2', 'pricing/pricing2'],
    ];

    for (const [route, view] of views) {
        const guest = renderFor(route, {});
        assert.deepEqual(guest, [
            path.join(__dirname, '../public/view', view),
            {
                data: {
                    id: null,
                    uuid: null,
                    type: null,
                    first_name: null,
                    last_name: null,
                    email: null,
                    ourGenerateNonce: 'test-nonce',
                },
            },
        ]);

        const authenticated = renderFor(route, {
            user: {
                uuid: 'encrypted-uuid',
                type: 3,
                first_name: 'First',
                last_name: 'Last',
                email_or_social_media: 'user@example.com',
            },
        });
        assert.deepEqual(authenticated, [
            path.join(__dirname, '../public/view', view),
            {
                data: {
                    uuid: 'encrypted-uuid',
                    type: 3,
                    first_name: 'First',
                    last_name: 'Last',
                    email: 'user@example.com',
                },
            },
        ]);
    }
});
