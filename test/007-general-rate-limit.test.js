// Acceptance tests for docs/tasks/007-No-Rate-Limiting.md
// (CODE_REVIEW Finding 7 -- no general API or login rate limiting).
//
// Run: node --test test/007-general-rate-limit.test.js
//
// These tests mount the real limiter factory on a tiny ephemeral Express app so
// the throttling behavior is exercised over HTTP without a database or SMTP
// connection.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const express = require('express');

const {
    createApiRateLimiter,
    FIFTEEN_MINUTES_MS,
    GENERAL_API_LIMIT,
    AUTH_LIMIT,
    RATE_LIMIT_JSON_MESSAGE,
    generalApiLimiter,
    loginLimiter,
    supportLoginLimiter,
} = require('../app/middleware/rate-limit/api.rate-limit.js');

const EMAIL = 'user@example.com';
const PASSWORD = 'super-secret-password';

function projectPath(...segments) {
    return path.join(__dirname, '..', ...segments);
}

function readSource(...segments) {
    return fs.readFileSync(projectPath(...segments), 'utf8');
}

async function withServer(limiter, handler, run, method = 'post') {
    const app = express();
    app.set('trust proxy', 'loopback');
    app.use(express.urlencoded({ extended: true }));

    app[method]('/probe', limiter, handler);

    const server = app.listen(0);
    await once(server, 'listening');

    try {
        await run(`http://127.0.0.1:${server.address().port}`);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

function probe(base, { ip = '203.0.113.10', method = 'POST', body } = {}) {
    return fetch(`${base}/probe`, {
        method,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Forwarded-For': ip,
        },
        body:
            method === 'OPTIONS'
                ? undefined
                : body || new URLSearchParams({ emailAddress: EMAIL, password: PASSWORD }).toString(),
    });
}

test('allows exactly N requests and rejects N+1 without invoking the handler', async () => {
    let handlerCalls = 0;
    const limiter = createApiRateLimiter({ windowMs: 60_000, limit: 3 });
    const handler = (req, res) => {
        handlerCalls += 1;
        res.send('ok');
    };

    await withServer(limiter, handler, async (base) => {
        for (let i = 0; i < 3; i += 1) {
            const response = await probe(base);
            assert.strictEqual(response.status, 200);
            await response.text();
        }

        const blocked = await probe(base);

        assert.strictEqual(blocked.status, 429);
        assert.strictEqual(handlerCalls, 3, 'the blocked request never reaches the handler');
        assert.ok(blocked.headers.get('retry-after'), 'Retry-After is present');
        assert.ok(
            blocked.headers.get('ratelimit') || blocked.headers.get('ratelimit-limit'),
            'a standardized RateLimit-* header is present',
        );

        const body = await blocked.text();
        assert.ok(body.includes(RATE_LIMIT_JSON_MESSAGE.message));
        for (const value of [EMAIL, PASSWORD, '203.0.113.10']) {
            assert.ok(!body.includes(value), `the blocked body does not echo ${value}`);
        }
    });
});

test('different IPs receive independent buckets', async () => {
    let handlerCalls = 0;
    const limiter = createApiRateLimiter({ windowMs: 60_000, limit: 2 });
    const handler = (req, res) => {
        handlerCalls += 1;
        res.send('ok');
    };

    await withServer(limiter, handler, async (base) => {
        for (let i = 0; i < 2; i += 1) {
            assert.strictEqual((await probe(base, { ip: '203.0.113.10' })).status, 200);
        }

        assert.strictEqual((await probe(base, { ip: '203.0.113.10' })).status, 429);
        assert.strictEqual((await probe(base, { ip: '203.0.113.11' })).status, 200);
        assert.strictEqual(handlerCalls, 3);
    });
});

test('OPTIONS requests are skipped and do not consume the POST bucket', async () => {
    let handlerCalls = 0;
    const limiter = createApiRateLimiter({ windowMs: 60_000, limit: 2 });

    const app = express();
    app.set('trust proxy', 'loopback');
    app.all('/probe', limiter, (req, res) => {
        handlerCalls += 1;
        res.send('ok');
    });

    const server = app.listen(0);
    await once(server, 'listening');

    try {
        const base = `http://127.0.0.1:${server.address().port}`;

        assert.strictEqual((await probe(base, { method: 'OPTIONS' })).status, 200);
        assert.strictEqual((await probe(base, { method: 'OPTIONS' })).status, 200);
        assert.strictEqual((await probe(base, { method: 'OPTIONS' })).status, 200);

        assert.strictEqual((await probe(base)).status, 200);
        assert.strictEqual((await probe(base)).status, 200);
        assert.strictEqual((await probe(base)).status, 429);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

test('rotating X-Forwarded-For from an untrusted connection cannot evade the limiter', async (t) => {
    const externalAddress = findNonLoopbackIPv4();

    if (!externalAddress) {
        t.skip('no non-loopback IPv4 interface available to simulate a direct client');
        return;
    }

    let handlerCalls = 0;
    const limiter = createApiRateLimiter({ windowMs: 60_000, limit: 2 });
    const handler = (req, res) => {
        handlerCalls += 1;
        res.send('ok');
    };

    const app = express();
    app.set('trust proxy', 'loopback');
    app.post('/probe', limiter, handler);

    const server = app.listen(0);
    await once(server, 'listening');

    try {
        const base = `http://${externalAddress}:${server.address().port}`;
        const spoofed = (ip) =>
            fetch(`${base}/probe`, {
                method: 'POST',
                headers: { 'X-Forwarded-For': ip },
            });

        let first;
        let second;
        let blocked;

        try {
            first = await spoofed('198.51.100.1');
            second = await spoofed('198.51.100.2');
            blocked = await spoofed('198.51.100.3');
        } catch (error) {
            t.skip(`could not reach the non-loopback address: ${error.message}`);
            return;
        }

        assert.strictEqual(first.status, 200);
        assert.strictEqual(second.status, 200);
        assert.strictEqual(blocked.status, 429, 'a new forwarded value does not create a new bucket');
        assert.strictEqual(handlerCalls, 2);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

test('production limiters use the documented windows and separate buckets', () => {
    assert.strictEqual(FIFTEEN_MINUTES_MS, 15 * 60 * 1000);
    assert.strictEqual(GENERAL_API_LIMIT, 100);
    assert.strictEqual(AUTH_LIMIT, 5);

    for (const limiter of [generalApiLimiter, loginLimiter, supportLoginLimiter]) {
        assert.strictEqual(typeof limiter, 'function');
    }

    assert.notStrictEqual(loginLimiter, supportLoginLimiter, 'login and support login have separate stores');
});

test('server mounts the general limiter on /api before authentication and API routes', () => {
    const serverSource = readSource('app', 'src', 'server.js');

    const limiterIndex = serverSource.indexOf("app.use('/api', generalApiLimiter)");
    const authIndex = serverSource.indexOf("app.use('/api', isAuthenticated)");
    const firstApiRouteIndex = serverSource.indexOf("require('../routes/index.js')(app)");

    assert.ok(limiterIndex !== -1, 'the general limiter is mounted on /api');
    assert.ok(authIndex !== -1, 'authentication is mounted on /api');
    assert.ok(firstApiRouteIndex !== -1, 'the first API route module is registered');
    assert.ok(limiterIndex < authIndex, 'rate limiting runs before authentication');
    assert.ok(limiterIndex < firstApiRouteIndex, 'rate limiting runs before API routes');

    assert.match(serverSource, /app\.use\(\s*['"]\/api['"]\s*,\s*generalApiLimiter\s*\)/);
    assert.doesNotMatch(serverSource, /app\.use\(\s*generalApiLimiter\s*\)/, 'the limiter is not mounted unscoped');
});

test('login routes apply their strict limiters before validation and handlers', () => {
    const routeSource = readSource('app', 'routes', 'index.js');

    assert.match(
        routeSource,
        /app\.post\(\s*\[?['"]\/api\/post\/login-process['"]\]?\s*,\s*apiRateLimit\.loginLimiter\s*,\s*middleware\.login_process\s*,\s*login\.create\s*\)/,
    );

    assert.match(
        routeSource,
        /app\.post\(\s*\[?['"]\/api\/post\/help-and-support-login-process['"]\]?\s*,\s*apiRateLimit\.supportLoginLimiter\s*,\s*helpAndSupportLogin\.create\s*\)/,
    );
});

test('existing password-reset limiters are still applied', () => {
    const forgotPasswordSource = readSource('app', 'routes', 'forgot-password.js');
    const routeSource = readSource('app', 'routes', 'index.js');

    assert.match(forgotPasswordSource, /create-reset-token['"]\s*,\s*createResetTokenLimiter/);
    assert.match(forgotPasswordSource, /send-email-for-change-password['"]\s*,\s*sendResetEmailLimiter/);
    assert.match(forgotPasswordSource, /['"]\/reset-password\/:token['"]\]?\s*,\s*resetPasswordPageLimiter/);
    assert.match(forgotPasswordSource, /['"]\/reset-password\/:token['"]\]?\s*,\s*resetPasswordSubmitLimiter/);
    assert.match(
        routeSource,
        /forgot-password-process['"]\]?\s*,\s*middleware\.passwordResetRateLimit\.forgotPasswordProcessLimiter/,
    );
});

test('login clients show a visible warning on HTTP 429', () => {
    for (const client of ['login.js', 'help-and-support-login.js']) {
        const source = readSource('public', 'assets', 'js', client);

        assert.match(source, /error:\s*function\s*\(xhr\)\s*\{/, `${client} has an error callback`);
        assert.match(source, /xhr\.status\s*===\s*429/, `${client} checks for 429`);
        assert.match(source, /Too many attempts/, `${client} shows a visible warning`);
    }
});

test('trust proxy is loopback, never true', () => {
    const serverSource = readSource('app', 'src', 'server.js');

    assert.match(serverSource, /app\.set\(\s*['"]trust proxy['"]\s*,\s*['"]loopback['"]\s*\)/);
    assert.doesNotMatch(serverSource, /app\.set\(\s*['"]trust proxy['"]\s*,\s*true\s*\)/);
});

function findNonLoopbackIPv4() {
    for (const addresses of Object.values(os.networkInterfaces())) {
        for (const address of addresses || []) {
            if (address.family === 'IPv4' && !address.internal) {
                return address.address;
            }
        }
    }

    return null;
}
