const { CLIENT_EMAIL_RECIPIENTS } = require('./email-recipients.config');

const MIDNIGHT_REPORT_SUBJECT = 'All World Trade - Daily Activity Report';

const EMAIL_TLS_OPTOUT_VARIABLE = 'EMAIL_TLS_REJECT_UNAUTHORIZED';

const isProductionEnvironment = (env) =>
    String(env.NODE_ENV || '')
        .trim()
        .toLowerCase() === 'production';

// SMTP certificate verification is enabled by default. It can only be turned
// off by explicitly setting EMAIL_TLS_REJECT_UNAUTHORIZED=false outside
// production, for local development against a self-signed SMTP server.
// Production ignores the opt-out, and any other value keeps verification on.
function buildEmailTlsOptions(env = process.env) {
    const optOutRequested = String(env[EMAIL_TLS_OPTOUT_VARIABLE] || '').trim() === 'false';

    return {
        rejectUnauthorized: !(optOutRequested && !isProductionEnvironment(env)),
    };
}

const EMAIL_TLS_OPTIONS = buildEmailTlsOptions();

// The application authenticates three independent mailboxes. Keep every
// credential group explicit so a flow can never silently send from the wrong
// mailbox when its environment variables are missing.
function buildEmailProfiles(env = process.env) {
    return {
        support: {
            auth: {
                user: env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
                pass: env.SUPPORT_RECEIVER_PASSWORD,
            },
            from: env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
        },
        registration: {
            auth: {
                user: env.EMAIL_USER,
                pass: env.EMAIL_PASSWORD,
            },
            from: env.EMAIL_SENDER_ADDRESS,
        },
        payment: {
            auth: {
                user: env.PAYMENT_EMAIL_ADDRESS,
                pass: env.PAYMENT_EMAIL_ADDRESS_PASSWORD,
            },
            from: env.PAYMENT_EMAIL_ADDRESS,
        },
    };
}

const EMAIL_PROFILES = buildEmailProfiles();

// Build the shared SMTP transport options for a named credential profile.
// Unknown profile names intentionally resolve to the support profile, matching
// the historical default transport; missing variables stay undefined instead
// of falling back to another mailbox.
function buildEmailTransportConfig(profileName = 'support', env = process.env) {
    const profiles = env === process.env ? EMAIL_PROFILES : buildEmailProfiles(env);
    const profile = profiles[profileName] || profiles.support;

    return {
        host: env.EMAIL_SERVERHOST,
        port: parseInt(env.EMAIL_PORT, 10) || 587,
        secure: false,
        auth: profile.auth,
        tls: buildEmailTlsOptions(env),
    };
}

const EMAIL_CONFIG = buildEmailTransportConfig('support');

module.exports = {
    CLIENT_EMAIL_RECIPIENTS,
    MIDNIGHT_REPORT_SUBJECT,
    EMAIL_CONFIG,
    EMAIL_PROFILES,
    EMAIL_TLS_OPTIONS,
    buildEmailProfiles,
    buildEmailTransportConfig,
    buildEmailTlsOptions,
    isProductionEnvironment,
};
