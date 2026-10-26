// Acceptance tests for docs/tasks/010-Helmet-Security-Headers-Disabled.md
// (CODE_REVIEW Finding 10 -- Helmet and CSP disabled).
//
// Run: node --test test/010-helmet-security-headers.test.js
//
// The tests mount the real middleware on an ephemeral Express app, so no
// database, SMTP connection, or production environment is required.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const express = require('express');

const { NONCE_BYTES, createNonce, nonceMiddleware } = require('../app/middleware/nonces');
const {
    FONT_SRC_HOSTS,
    IMG_SRC_HOSTS,
    SCRIPT_SRC_HOSTS,
    STYLE_SRC_HOSTS,
    buildContentSecurityPolicy,
    createHelmetMiddleware,
    isCspReportOnly,
    isProductionEnvironment,
} = require('../app/middleware/helmet');
const { PERMISSIONS_POLICY, permissionsPolicyMiddleware } = require('../app/middleware/permissions-policy');

function projectPath(...segments) {
    return path.join(__dirname, '..', ...segments);
}

function readSource(...segments) {
    return fs.readFileSync(projectPath(...segments), 'utf8');
}

function listEjsFiles(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            files.push(...listEjsFiles(entryPath));
        } else if (entry.name.endsWith('.ejs')) {
            files.push(entryPath);
        }
    }

    return files;
}

async function withServer(app, run) {
    const server = app.listen(0);
    await once(server, 'listening');

    try {
        await run(`http://127.0.0.1:${server.address().port}`);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

function makeApp({ reportOnly = true, isProduction = false, withNonce = true } = {}) {
    const app = express();

    if (withNonce) app.use(nonceMiddleware);
    app.use(createHelmetMiddleware({ reportOnly, isProduction }));
    app.use(permissionsPolicyMiddleware);

    app.get('/page', (req, res) => {
        res.type('html').send(
            `<!doctype html><html><body><script nonce="${res.locals.cspNonce}">window.__ok = true;</script></body></html>`,
        );
    });

    app.get('/api/probe', (req, res) => {
        res.status(200).json({ ok: true });
    });

    return app;
}

function getCsp(headers) {
    return headers.get('content-security-policy') || headers.get('content-security-policy-report-only') || '';
}

function getNonce(csp) {
    const match = csp.match(/'nonce-([^']+)'/);
    return match ? match[1] : null;
}

test('Helmet is mounted in the live source after the nonce middleware', () => {
    const source = readSource('app/src/server.js');

    assert.match(source, /const \{ nonceMiddleware \} = require\('\.\.\/middleware\/nonces'\)/);
    assert.match(source, /const helmet = require\('\.\.\/middleware\/helmet'\)/);
    assert.match(source, /app\.use\(nonceMiddleware\)/);
    assert.match(source, /app\.use\(helmet\)/);
    assert.match(source, /app\.use\(permissionsPolicyMiddleware\)/);

    assert.ok(!/\/\/\s*app\.use\(helmet\)/.test(source), 'the old commented Helmet mount is removed');
    assert.ok(!/lodashNonce/.test(source), 'the module-level nonce is no longer used');
    assert.ok(!/res\.setHeader\('X-Frame-Options'/.test(source), 'Helmet owns X-Frame-Options');
    assert.ok(
        !/res\.setHeader\(\s*['"]Content-Security-Policy/.test(source),
        'Helmet is the only source of the Content-Security-Policy header',
    );

    const nonceIndex = source.indexOf('app.use(nonceMiddleware)');
    const helmetIndex = source.indexOf('app.use(helmet)');
    const cacheHeaderIndex = source.indexOf("res.set('Cache-Control'");

    assert.ok(nonceIndex > -1 && helmetIndex > nonceIndex, 'nonce middleware runs before Helmet');
    assert.ok(cacheHeaderIndex > helmetIndex, 'Helmet runs before the custom header middleware');
});

test('every inline script in an active EJS view has a per-request nonce', () => {
    const viewRoot = projectPath('public/view');
    const files = listEjsFiles(viewRoot).filter((file) => !/backup|copy/i.test(file));
    const missing = [];

    for (const file of files) {
        const source = fs.readFileSync(file, 'utf8');

        source.replace(/<script\b([^>]*)>/gi, (tag, attributes) => {
            const isInline = !/\bsrc\s*=/i.test(attributes);

            if (isInline && !/\bnonce\s*=/i.test(attributes)) {
                missing.push(`${path.relative(projectPath(), file)}: ${tag.trim()}`);
            }

            return tag;
        });
    }

    assert.deepStrictEqual(missing, [], 'inline scripts must carry nonce="<%= cspNonce %>"');

    const loginView = readSource('public/view/login/index.ejs');
    assert.ok(!loginView.includes('ourGenerateNonce'), 'the nonce is not logged or exposed as a JS variable');
});

test('external resources in active views are covered by the CSP allowlist', () => {
    const viewRoot = projectPath('public/view');
    const files = listEjsFiles(viewRoot).filter((file) => !/backup|copy/i.test(file));
    const violations = [];

    const check = (kind, allowedHosts, url, file) => {
        if (!/^https?:\/\//i.test(url)) return;

        const origin = new URL(url).origin;

        if (!allowedHosts.includes(origin)) {
            violations.push(`${kind}: ${origin} in ${path.relative(projectPath(), file)}`);
        }
    };

    for (const file of files) {
        const source = fs.readFileSync(file, 'utf8');

        for (const match of source.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi)) {
            check('script-src', SCRIPT_SRC_HOSTS, match[1], file);
        }

        for (const match of source.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)) {
            check('img-src', IMG_SRC_HOSTS, match[1], file);
        }

        for (const match of source.matchAll(/<link\b[^>]*>/gi)) {
            const tag = match[0];
            const href = tag.match(/\bhref="([^"]+)"/i);
            const rel = tag.match(/\brel="([^"]+)"/i);

            if (!href || !rel || !/stylesheet|preconnect|dns-prefetch/i.test(rel[1])) continue;

            const isFont = /fonts\.gstatic\.com/i.test(href[1]);
            check(isFont ? 'font-src' : 'style-src', isFont ? FONT_SRC_HOSTS : STYLE_SRC_HOSTS, href[1], file);
        }
    }

    assert.deepStrictEqual(violations, [], 'add new external hosts to the explicit CSP allowlist');
});

test('report-only mode emits only the report-only CSP header', async () => {
    await withServer(makeApp({ reportOnly: true, isProduction: false }), async (base) => {
        const response = await fetch(`${base}/page`);

        assert.strictEqual(response.status, 200);
        assert.ok(response.headers.has('content-security-policy-report-only'));
        assert.strictEqual(response.headers.get('content-security-policy'), null);
    });
});

test('standard security headers are present and intentionally set', async () => {
    await withServer(makeApp({ reportOnly: true, isProduction: false }), async (base) => {
        const response = await fetch(`${base}/page`);

        assert.strictEqual(response.headers.get('x-content-type-options'), 'nosniff');
        assert.strictEqual(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
        assert.strictEqual(response.headers.get('x-frame-options'), 'SAMEORIGIN');
        assert.strictEqual(response.headers.get('x-dns-prefetch-control'), 'off');
        assert.strictEqual(response.headers.get('permissions-policy'), PERMISSIONS_POLICY);
        assert.strictEqual(response.headers.get('strict-transport-security'), null);
    });
});

test('CSP contains the required directives and no unsafe-eval or wildcard script source', async () => {
    await withServer(makeApp({ reportOnly: true, isProduction: false }), async (base) => {
        const response = await fetch(`${base}/page`);
        const csp = getCsp(response.headers);

        for (const directive of [
            "default-src 'self'",
            'script-src',
            'style-src',
            'img-src',
            'font-src',
            'connect-src',
            'frame-src',
            'media-src',
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'self'",
        ]) {
            assert.ok(csp.includes(directive), `CSP should contain ${directive}`);
        }

        assert.ok(!csp.includes("'unsafe-eval'"), 'unsafe-eval must not be allowed');
        assert.ok(!/script-src[^;]*\s\*\s*(;|$)/.test(csp), 'script-src must not use a wildcard');
        assert.ok(!csp.includes("'strict-dynamic'"), 'strict-dynamic is unsafe until every script is nonced');
        assert.ok(!csp.includes('upgrade-insecure-requests'), 'local HTTP must not upgrade requests');
        assert.ok(csp.includes("script-src-attr 'unsafe-inline'"), 'inline event handlers are documented debt');
    });
});

test('the nonce is unique per request and matches the rendered script tag', async () => {
    await withServer(makeApp({ reportOnly: true, isProduction: false }), async (base) => {
        const first = await fetch(`${base}/page`);
        const second = await fetch(`${base}/page`);

        const firstNonce = getNonce(getCsp(first.headers));
        const secondNonce = getNonce(getCsp(second.headers));

        assert.ok(firstNonce);
        assert.ok(secondNonce);
        assert.notStrictEqual(firstNonce, secondNonce, 'nonces must not be reused across responses');

        const firstBody = await first.text();
        const secondBody = await second.text();

        assert.ok(firstBody.includes(`nonce="${firstNonce}"`));
        assert.ok(secondBody.includes(`nonce="${secondNonce}"`));
    });
});

test('enforced mode emits Content-Security-Policy instead of report-only', async () => {
    await withServer(makeApp({ reportOnly: false, isProduction: false }), async (base) => {
        const response = await fetch(`${base}/page`);

        assert.ok(response.headers.has('content-security-policy'));
        assert.strictEqual(response.headers.get('content-security-policy-report-only'), null);
        assert.ok(getCsp(response.headers).includes("default-src 'self'"));
    });
});

test('HSTS and upgrade-insecure-requests are production-only', async () => {
    await withServer(makeApp({ reportOnly: false, isProduction: true }), async (base) => {
        const response = await fetch(`${base}/page`);
        const csp = getCsp(response.headers);

        assert.match(response.headers.get('strict-transport-security'), /max-age=15552000/);
        assert.ok(!response.headers.get('strict-transport-security').includes('preload'));
        assert.ok(csp.includes('upgrade-insecure-requests'));
    });

    await withServer(makeApp({ reportOnly: false, isProduction: false }), async (base) => {
        const response = await fetch(`${base}/page`);

        assert.strictEqual(response.headers.get('strict-transport-security'), null);
        assert.ok(!getCsp(response.headers).includes('upgrade-insecure-requests'));
    });
});

test('API and static responses keep their behavior while gaining headers', async () => {
    const staticDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'awt-helmet-'));
    fs.writeFileSync(path.join(staticDirectory, 'probe.css'), 'body { color: #000; }');

    const app = makeApp({ reportOnly: true, isProduction: false });
    app.use(express.static(staticDirectory));

    try {
        await withServer(app, async (base) => {
            const apiResponse = await fetch(`${base}/api/probe`);

            assert.strictEqual(apiResponse.status, 200);
            assert.deepStrictEqual(await apiResponse.json(), { ok: true });
            assert.strictEqual(apiResponse.headers.get('x-content-type-options'), 'nosniff');
            assert.ok(apiResponse.headers.has('content-security-policy-report-only'));

            const staticResponse = await fetch(`${base}/probe.css`);

            assert.strictEqual(staticResponse.status, 200);
            assert.match(staticResponse.headers.get('content-type'), /text\/css/);
            assert.strictEqual(staticResponse.headers.get('x-content-type-options'), 'nosniff');
            assert.strictEqual(await staticResponse.text(), 'body { color: #000; }');
        });
    } finally {
        fs.rmSync(staticDirectory, { recursive: true, force: true });
    }
});

test('only one CSP header is emitted', async () => {
    await withServer(makeApp({ reportOnly: true, isProduction: false }), async (base) => {
        const response = await fetch(`${base}/page`);
        const csp = getCsp(response.headers);

        assert.ok(csp);
        assert.ok(!csp.includes(', default-src'), 'duplicate CSP headers would be joined with a comma');
        assert.strictEqual(csp.split('default-src').length - 1, 1, 'default-src must appear exactly once');
    });
});

test('nonce middleware sets both request and response-local values', async () => {
    const app = express();
    app.use(nonceMiddleware);
    app.get('/probe', (req, res) => {
        res.json({ request: req.cspNonce, local: res.locals.cspNonce });
    });

    await withServer(app, async (base) => {
        const first = await (await fetch(`${base}/probe`)).json();
        const second = await (await fetch(`${base}/probe`)).json();

        assert.strictEqual(first.request, first.local);
        assert.strictEqual(second.request, second.local);
        assert.notStrictEqual(first.request, second.request);
        assert.strictEqual(createNonce().length, Math.ceil(NONCE_BYTES / 3) * 4);
        assert.match(createNonce(), /^[A-Za-z0-9+/]+={0,2}$/);
    });
});

test('CSP mode and environment helpers are explicit', () => {
    assert.strictEqual(isCspReportOnly({}), true);
    assert.strictEqual(isCspReportOnly({ CSP_REPORT_ONLY: 'true' }), true);
    assert.strictEqual(isCspReportOnly({ CSP_REPORT_ONLY: 'false' }), false);
    assert.strictEqual(isProductionEnvironment({ NODE_ENV: 'production' }), true);
    assert.strictEqual(isProductionEnvironment({ NODE_ENV: 'nonprod' }), false);

    const localPolicy = buildContentSecurityPolicy({ reportOnly: true, isProduction: false });
    const productionPolicy = buildContentSecurityPolicy({ reportOnly: false, isProduction: true });

    assert.strictEqual(localPolicy.reportOnly, true);
    assert.strictEqual(localPolicy.directives.upgradeInsecureRequests, null);
    assert.deepStrictEqual(productionPolicy.directives.upgradeInsecureRequests, []);
});
