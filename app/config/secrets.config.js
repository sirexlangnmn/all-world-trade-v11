'use strict';

const REQUIRED_SECRETS = Object.freeze(['API_KEY_SECRET', 'SESSION_SECRET', 'JWT_SECRET']);

const KNOWN_INSECURE_SECRETS = Object.freeze([
    'all_world_trade_default_secret',
    'all_world_trade_secret_random_string',
    'all_world_trade_jwt_super_secret',
]);

const PLACEHOLDER_PATTERN =
    /(default|changeme|change_me|placeholder|example|random_string|super_secret|your[_-]?secret)/i;

const MIN_SECRET_LENGTH = 32;

const SECRET_GENERATION_HINT = "node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"";

/**
 * Return the human-readable problems for a single secret. An empty array means
 * the value is acceptable. The value itself is never included in the output.
 */
function describeSecretProblems(name, rawValue) {
    if (typeof rawValue !== 'string') {
        return [`${name} is missing`];
    }

    const value = rawValue.trim();

    if (value === '') {
        return [`${name} is missing`];
    }

    const problems = [];

    if (KNOWN_INSECURE_SECRETS.includes(value) || PLACEHOLDER_PATTERN.test(value)) {
        problems.push(`${name} uses a known default or placeholder value`);
    }

    if (value.length < MIN_SECRET_LENGTH) {
        problems.push(`${name} is shorter than ${MIN_SECRET_LENGTH} characters`);
    }

    return problems;
}

/**
 * Fail closed when any required application secret is missing, empty,
 * placeholder-like, a known default, or shorter than MIN_SECRET_LENGTH.
 *
 * @param {NodeJS.ProcessEnv|Record<string, unknown>} [env] environment to check
 * @throws {Error} when one or more secrets are invalid
 */
function validateSecrets(env = process.env) {
    const problems = REQUIRED_SECRETS.flatMap((name) => describeSecretProblems(name, env[name]));

    if (problems.length === 0) {
        return;
    }

    throw new Error(
        `Insecure secret configuration: ${problems.join('; ')}. ` +
            `Generate each secret with: ${SECRET_GENERATION_HINT}`,
    );
}

module.exports = {
    REQUIRED_SECRETS,
    KNOWN_INSECURE_SECRETS,
    PLACEHOLDER_PATTERN,
    MIN_SECRET_LENGTH,
    validateSecrets,
};
