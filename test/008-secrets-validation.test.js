// Acceptance tests for docs/tasks/008-Weak-Default-Secrets-in-Environment.md
// (CODE_REVIEW Finding 8 -- weak/default application secrets).
//
// Run: node --test test/008-secrets-validation.test.js
//
// These tests exercise the validator with explicit env objects so they never
// depend on the developer's .env or on any real secret value.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
    REQUIRED_SECRETS,
    KNOWN_INSECURE_SECRETS,
    MIN_SECRET_LENGTH,
    validateSecrets,
} = require('../app/config/secrets.config.js');

const KNOWN_DEFAULTS = [
    'all_world_trade_default_secret',
    'all_world_trade_secret_random_string',
    'all_world_trade_jwt_super_secret',
];

const PLACEHOLDERS = [
    'changeme',
    'change_me',
    'placeholder',
    'example',
    'your_secret',
    'your-secret',
    'random_string',
    'super_secret',
];

function projectPath(...segments) {
    return path.join(__dirname, '..', ...segments);
}

function readSource(...segments) {
    return fs.readFileSync(projectPath(...segments), 'utf8');
}

function strongSecret() {
    return crypto.randomBytes(64).toString('hex');
}

function validEnv(overrides = {}) {
    return {
        API_KEY_SECRET: strongSecret(),
        SESSION_SECRET: strongSecret(),
        JWT_SECRET: strongSecret(),
        ...overrides,
    };
}

function captureError(fn) {
    try {
        fn();
    } catch (error) {
        return error;
    }

    return null;
}

test('accepts three strong, independent secrets', () => {
    assert.doesNotThrow(() => validateSecrets(validEnv()));
});

test('accepts a 128-character value generated with crypto.randomBytes(64)', () => {
    const value = crypto.randomBytes(64).toString('hex');
    assert.equal(value.length, 128);
    assert.doesNotThrow(() => validateSecrets(validEnv({ JWT_SECRET: value })));
});

test('accepts a value of exactly the minimum length without placeholder text', () => {
    const value = 'a'.repeat(MIN_SECRET_LENGTH);
    assert.doesNotThrow(() => validateSecrets(validEnv({ SESSION_SECRET: value })));
});

test('accepts very long values without crashing', () => {
    const value = crypto.randomBytes(5_000).toString('hex');
    assert.doesNotThrow(() => validateSecrets(validEnv({ API_KEY_SECRET: value })));
});

test('trims surrounding whitespace and accepts the trimmed value', () => {
    const value = `  ${strongSecret()}\n`;
    assert.doesNotThrow(() => validateSecrets(validEnv({ SESSION_SECRET: value })));
});

for (const name of REQUIRED_SECRETS) {
    test(`rejects missing ${name} and names the variable`, () => {
        const env = validEnv();
        delete env[name];

        const error = captureError(() => validateSecrets(env));

        assert.ok(error, 'validation throws');
        assert.match(error.message, new RegExp(name));
        assert.match(error.message, /missing/);
    });

    test(`rejects empty ${name}`, () => {
        const error = captureError(() => validateSecrets(validEnv({ [name]: '' })));
        assert.ok(error);
        assert.match(error.message, new RegExp(name));
    });

    test(`rejects whitespace-only ${name}`, () => {
        const error = captureError(() => validateSecrets(validEnv({ [name]: '   \n\t ' })));
        assert.ok(error);
        assert.match(error.message, new RegExp(name));
    });

    test(`rejects non-string ${name}`, () => {
        for (const value of [undefined, null, 12345, {}, []]) {
            const error = captureError(() => validateSecrets(validEnv({ [name]: value })));
            assert.ok(error, `rejects ${String(value)}`);
            assert.match(error.message, new RegExp(name));
        }
    });

    test(`rejects a ${name} one character below the minimum length`, () => {
        const error = captureError(() => validateSecrets(validEnv({ [name]: 'a'.repeat(MIN_SECRET_LENGTH - 1) })));
        assert.ok(error);
        assert.match(error.message, new RegExp(name));
        assert.match(error.message, new RegExp(`shorter than ${MIN_SECRET_LENGTH}`));
    });
}

test('reports every invalid variable in a single error message', () => {
    const error = captureError(() => validateSecrets({}));

    assert.ok(error);
    for (const name of REQUIRED_SECRETS) {
        assert.match(error.message, new RegExp(name), `error names ${name}`);
    }
});

test('rejects known default secrets', () => {
    for (const value of KNOWN_DEFAULTS) {
        const error = captureError(() => validateSecrets(validEnv({ JWT_SECRET: value })));

        assert.ok(error, `rejects ${value}`);
        assert.match(error.message, /known default or placeholder/);
    }
});

test('rejects mixed-case known defaults', () => {
    const error = captureError(() =>
        validateSecrets(validEnv({ SESSION_SECRET: 'ALL_WORLD_TRADE_SECRET_RANDOM_STRING' })),
    );

    assert.ok(error);
    assert.match(error.message, /known default or placeholder/);
});

test('rejects known defaults even when surrounded by whitespace', () => {
    const error = captureError(() =>
        validateSecrets(validEnv({ API_KEY_SECRET: '  all_world_trade_default_secret  ' })),
    );

    assert.ok(error);
    assert.match(error.message, /known default or placeholder/);
});

test('rejects placeholder-like secrets', () => {
    for (const value of PLACEHOLDERS) {
        const error = captureError(() => validateSecrets(validEnv({ JWT_SECRET: value })));
        assert.ok(error, `rejects ${value}`);
    }
});

test('the error never contains the submitted secret value', () => {
    const submitted = 'too-short-secret-value-XYZ-123';
    const error = captureError(() => validateSecrets(validEnv({ SESSION_SECRET: submitted })));

    assert.ok(error);
    assert.ok(!error.message.includes(submitted), 'error does not echo the secret');
});

test('the error names the offending variable and includes a generation hint', () => {
    const error = captureError(() => validateSecrets(validEnv({ JWT_SECRET: 'short' })));

    assert.ok(error);
    assert.match(error.message, /JWT_SECRET/);
    assert.match(error.message, /randomBytes\(64\)/);
});

test('validation does not write to console.log', () => {
    const originalLog = console.log;
    let calls = 0;
    console.log = () => {
        calls += 1;
    };

    try {
        assert.throws(() => validateSecrets({}));
        assert.doesNotThrow(() => validateSecrets(validEnv()));
    } finally {
        console.log = originalLog;
    }

    assert.equal(calls, 0, 'no secret or validation detail is logged');
});

test('the known weak defaults are part of the exported reject list', () => {
    for (const value of KNOWN_DEFAULTS) {
        assert.ok(KNOWN_INSECURE_SECRETS.includes(value), `${value} is rejected`);
    }
});

test('.env.example contains placeholder secrets that fail validation', () => {
    const example = readSource('.env.example');
    const env = {};

    for (const name of REQUIRED_SECRETS) {
        const match = example.match(new RegExp(`^${name}=(.*)$`, 'm'));
        assert.ok(match, `.env.example defines ${name}`);
        env[name] = match[1].trim();
    }

    assert.throws(() => validateSecrets(env));
});

test('server validates secrets after dotenv and before session/routes', () => {
    const serverSource = readSource('app', 'src', 'server.js');

    const dotenvIndex = serverSource.indexOf("require('dotenv').config()");
    const requireIndex = serverSource.indexOf("require('../config/secrets.config.js')");
    const callIndex = serverSource.indexOf('validateSecrets();');
    const sessionIndex = serverSource.indexOf('const sessionMiddleware = session(');
    const firstRouteIndex = serverSource.indexOf("require('../routes/index.js')(app)");

    assert.ok(dotenvIndex !== -1, 'dotenv is loaded');
    assert.ok(requireIndex !== -1, 'the validator module is required');
    assert.ok(callIndex !== -1, 'validateSecrets is called');
    assert.ok(sessionIndex !== -1, 'express-session is constructed');
    assert.ok(firstRouteIndex !== -1, 'the first API route module is registered');

    assert.ok(dotenvIndex < requireIndex, 'validator is required after dotenv');
    assert.ok(requireIndex < callIndex, 'validator is called after its require');
    assert.ok(callIndex < sessionIndex, 'validation runs before express-session');
    assert.ok(callIndex < firstRouteIndex, 'validation runs before API routes');
});

test('startup no longer logs or stores the API key secret', () => {
    const serverSource = readSource('app', 'src', 'server.js');

    assert.doesNotMatch(serverSource, /api_key_secret/, 'the api_key_secret local and log field are removed');
    assert.doesNotMatch(serverSource, /process\.env\.API_KEY_SECRET/, 'server.js does not read the API key directly');
});
