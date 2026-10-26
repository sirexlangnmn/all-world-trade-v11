// Acceptance tests for docs/tasks/011-TLS-Verification-Disabled-for-Email-Transport.md
// (CODE_REVIEW Finding 11 -- TLS certificate verification disabled for email).
//
// Run: node --test test/011-email-tls-verification.test.js
//
// These tests never open an SMTP connection and never read real credentials.
// Runtime configuration is exercised in a child process with a controlled env.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { buildEmailTlsOptions } = require('../app/config/email.config.js');

const PROJECT_ROOT = path.join(__dirname, '..');
const APP_ROOT = path.join(PROJECT_ROOT, 'app');
const TLS_OPTOUT_VARIABLE = 'EMAIL_TLS_REJECT_UNAUTHORIZED';

function readSource(...segments) {
    return fs.readFileSync(path.join(PROJECT_ROOT, ...segments), 'utf8');
}

function listJavaScriptFiles(directory) {
    const files = [];

    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            files.push(...listJavaScriptFiles(entryPath));
        } else if (entry.name.endsWith('.js')) {
            files.push(entryPath);
        }
    }

    return files;
}

function sourceFiles() {
    return listJavaScriptFiles(APP_ROOT).map((filePath) => ({
        relativePath: path.relative(PROJECT_ROOT, filePath),
        source: fs.readFileSync(filePath, 'utf8'),
    }));
}

function resolveTlsOptionsInChild(overrides = {}) {
    const env = { ...process.env };
    delete env[TLS_OPTOUT_VARIABLE];

    Object.assign(env, overrides);

    const script = [
        "const { EMAIL_CONFIG } = require('./app/config/email.config.js');",
        'process.stdout.write(JSON.stringify(EMAIL_CONFIG.tls));',
    ].join('');

    const output = execFileSync(process.execPath, ['-e', script], {
        cwd: PROJECT_ROOT,
        env,
        encoding: 'utf8',
    });

    return JSON.parse(output);
}

test('verification is enabled by default in production', () => {
    assert.equal(buildEmailTlsOptions({ NODE_ENV: 'production' }).rejectUnauthorized, true);
});

test('verification is enabled by default when the environment is empty', () => {
    assert.equal(buildEmailTlsOptions({}).rejectUnauthorized, true);
    assert.equal(buildEmailTlsOptions().rejectUnauthorized, true);
});

test('production ignores the development opt-out', () => {
    assert.equal(
        buildEmailTlsOptions({ NODE_ENV: 'production', [TLS_OPTOUT_VARIABLE]: 'false' }).rejectUnauthorized,
        true,
    );
});

test('production is matched case-insensitively so a casing mistake cannot disable verification', () => {
    assert.equal(
        buildEmailTlsOptions({ NODE_ENV: 'Production', [TLS_OPTOUT_VARIABLE]: 'false' }).rejectUnauthorized,
        true,
    );
});

test('an explicit opt-out works outside production', () => {
    assert.equal(
        buildEmailTlsOptions({ NODE_ENV: 'development', [TLS_OPTOUT_VARIABLE]: 'false' }).rejectUnauthorized,
        false,
    );
    assert.equal(
        buildEmailTlsOptions({ NODE_ENV: 'nonprod', [TLS_OPTOUT_VARIABLE]: 'false' }).rejectUnauthorized,
        false,
    );
});

test('malformed or misleading opt-out values keep verification enabled', () => {
    for (const value of ['FALSE', 'False', '0', 'no', 'off', 'null', '', '   ', 'true']) {
        assert.equal(
            buildEmailTlsOptions({ NODE_ENV: 'development', [TLS_OPTOUT_VARIABLE]: value }).rejectUnauthorized,
            true,
            `${JSON.stringify(value)} must not disable verification`,
        );
    }
});

test('the opt-in value is trimmed before comparison', () => {
    assert.equal(
        buildEmailTlsOptions({ NODE_ENV: 'development', [TLS_OPTOUT_VARIABLE]: '  false  ' }).rejectUnauthorized,
        false,
    );
});

test('no application source disables certificate verification', () => {
    for (const { relativePath, source } of sourceFiles()) {
        assert.doesNotMatch(
            source,
            /rejectUnauthorized\s*:\s*false/,
            `${relativePath} must not contain an insecure rejectUnauthorized: false`,
        );
        assert.doesNotMatch(
            source,
            /NODE_TLS_REJECT_UNAUTHORIZED/,
            `${relativePath} must not set the process-wide TLS opt-out`,
        );
    }
});

test('every Nodemailer transport uses the shared secure configuration', () => {
    const transportFiles = sourceFiles().filter(({ source }) => /nodemailer\.createTransport\s*\(/.test(source));

    assert.ok(transportFiles.length > 0, 'expected at least one Nodemailer transport');

    for (const { relativePath, source } of transportFiles) {
        const transportCount = (source.match(/nodemailer\.createTransport\s*\(/g) || []).length;
        const usesSharedConfig = /nodemailer\.createTransport\s*\(\s*EMAIL_CONFIG\s*\)/.test(source);

        if (usesSharedConfig) {
            continue;
        }

        const sharedTlsCount = (source.match(/tls\s*:\s*EMAIL_TLS_OPTIONS/g) || []).length;

        assert.ok(
            sharedTlsCount >= transportCount,
            `${relativePath} has ${transportCount} transport(s) but only ${sharedTlsCount} shared TLS option(s)`,
        );
    }
});

test('each inline transport keeps its original SMTP credentials', () => {
    const expectedCredentials = {
        'app/routes/email-marketing.js': ['SUPPORT_RECEIVER_EMAIL_ADDRESS', 'SUPPORT_RECEIVER_PASSWORD'],
        'app/routes/forgot-password.js': ['EMAIL_USER', 'EMAIL_PASSWORD'],
        'app/routes/upload-file.js': [
            'EMAIL_USER',
            'EMAIL_PASSWORD',
            'PAYMENT_EMAIL_ADDRESS',
            'PAYMENT_EMAIL_ADDRESS_PASSWORD',
        ],
        'app/shared/email-template.js': ['SUPPORT_RECEIVER_EMAIL_ADDRESS', 'SUPPORT_RECEIVER_PASSWORD'],
        'app/db_controllers/support_messages.controller.js': [
            'SUPPORT_RECEIVER_EMAIL_ADDRESS',
            'SUPPORT_RECEIVER_PASSWORD',
        ],
    };

    for (const [relativePath, variables] of Object.entries(expectedCredentials)) {
        const source = readSource(relativePath);

        for (const variable of variables) {
            assert.match(
                source,
                new RegExp(`process\\.env\\.${variable}`),
                `${relativePath} must still read process.env.${variable}`,
            );
        }
    }
});

test('the live configuration resolves to a secure TLS option', () => {
    assert.deepEqual(resolveTlsOptionsInChild({ NODE_ENV: 'production' }), {
        rejectUnauthorized: true,
    });
});

test('the live configuration ignores the opt-out in production', () => {
    assert.deepEqual(resolveTlsOptionsInChild({ NODE_ENV: 'production', [TLS_OPTOUT_VARIABLE]: 'false' }), {
        rejectUnauthorized: true,
    });
});

test('.env.example keeps verification enabled by default', () => {
    const example = readSource('.env.example');

    assert.match(example, new RegExp(`^${TLS_OPTOUT_VARIABLE}=true$`, 'm'));
    assert.match(example, /Ignored when NODE_ENV=production/);
});

test('README documents that production cannot disable verification', () => {
    const readme = readSource('README.md');

    assert.match(readme, /EMAIL_TLS_REJECT_UNAUTHORIZED/);
    assert.match(readme, /Production \(`NODE_ENV=production`\) always verifies certificates/);
});

test('email transport changes do not log credentials', () => {
    const touchedFiles = [
        'app/config/email.config.js',
        'app/routes/email-marketing.js',
        'app/routes/forgot-password.js',
        'app/routes/upload-file.js',
        'app/shared/email-template.js',
        'app/db_controllers/support_messages.controller.js',
    ];

    for (const relativePath of touchedFiles) {
        const source = readSource(relativePath);

        assert.doesNotMatch(
            source,
            /console\.[a-z]+\([^\n]*(SUPPORT_RECEIVER_PASSWORD|EMAIL_PASSWORD|PAYMENT_EMAIL_ADDRESS_PASSWORD)/,
            `${relativePath} must not log SMTP passwords`,
        );
    }
});
