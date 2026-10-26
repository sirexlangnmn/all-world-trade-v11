// Acceptance tests for docs/tasks/051-Missing-Rate-Limiting-on-Reset-Endpoints.md
// (CODE_REVIEW Finding 51 -- unthrottled password reset endpoints).
//
// Run: node --test test/051-reset-endpoints-rate-limit.test.js
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
    createPasswordResetRateLimiter,
    FIFTEEN_MINUTES_MS,
    STRICT_LIMIT,
    RESET_PAGE_LIMIT,
    RATE_LIMIT_JSON_MESSAGE,
    RATE_LIMIT_TEXT_MESSAGE,
    forgotPasswordProcessLimiter,
    createResetTokenLimiter,
    sendResetEmailLimiter,
    resetPasswordPageLimiter,
    resetPasswordSubmitLimiter,
} = require('../app/middleware/rate-limit/password-reset.rate-limit.js');

const EMAIL = 'user@example.com';
const UUID = 'rate-limit-test-uuid';
const TOKEN = 'rate-limit-test-token';

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

function probe(
    base,
    {
        ip = '203.0.113.10',
        body = new URLSearchParams({
            emailAddress: EMAIL,
            uuid: UUID,
            token: TOKEN,
        }).toString(),
    } = {},
) {
    return fetch(`${base}/probe`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Forwarded-For': ip,
        },
        body,
    });
}

test('allows exactly N requests and rejects N+1 without invoking the handler', async () => {
    let handlerCalls = 0;
    const limiter = createPasswordResetRateLimiter({ windowMs: 60_000, limit: 3 });
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
        for (const value of [EMAIL, UUID, TOKEN, '203.0.113.10']) {
            assert.ok(!body.includes(value), `the blocked body does not echo ${value}`);
        }
    });
});

test('different IPs receive independent buckets', async () => {
    let handlerCalls = 0;
    const limiter = createPasswordResetRateLimiter({ windowMs: 60_000, limit: 2 });
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

test('rotating X-Forwarded-For from an untrusted connection cannot evade the limiter', async (t) => {
    const externalAddress = findNonLoopbackIPv4();

    if (!externalAddress) {
        t.skip('no non-loopback IPv4 interface available to simulate a direct client');
        return;
    }

    let handlerCalls = 0;
    const limiter = createPasswordResetRateLimiter({ windowMs: 60_000, limit: 2 });
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

test('the GET reset-page message is plain text and generic', async () => {
    const limiter = createPasswordResetRateLimiter({
        windowMs: 60_000,
        limit: 1,
        message: RATE_LIMIT_TEXT_MESSAGE,
    });
    const handler = (req, res) => res.send('ok');

    await withServer(
        limiter,
        handler,
        async (base) => {
            const getProbe = () =>
                fetch(`${base}/probe`, {
                    headers: { 'X-Forwarded-For': '203.0.113.10' },
                });

            assert.strictEqual((await getProbe()).status, 200);

            const blocked = await getProbe();

            assert.strictEqual(blocked.status, 429);
            assert.strictEqual(await blocked.text(), RATE_LIMIT_TEXT_MESSAGE);
        },
        'get',
    );
});

test('the production limiters use the documented windows and limits', () => {
    assert.strictEqual(FIFTEEN_MINUTES_MS, 15 * 60 * 1000);
    assert.strictEqual(STRICT_LIMIT, 5);
    assert.strictEqual(RESET_PAGE_LIMIT, 30);

    const limiters = [
        forgotPasswordProcessLimiter,
        createResetTokenLimiter,
        sendResetEmailLimiter,
        resetPasswordPageLimiter,
        resetPasswordSubmitLimiter,
    ];

    for (const limiter of limiters) {
        assert.strictEqual(typeof limiter, 'function');
    }

    assert.strictEqual(new Set(limiters).size, 5, 'each endpoint has its own limiter/store');
});

test('trust proxy is loopback, never true', () => {
    const serverSource = fs.readFileSync(path.join(__dirname, '..', 'app', 'src', 'server.js'), 'utf8');

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
