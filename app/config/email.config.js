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

const EMAIL_CONFIG = {
    host: process.env.EMAIL_SERVERHOST,
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: false,
    auth: {
        user: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
        pass: process.env.SUPPORT_RECEIVER_PASSWORD,
    },
    tls: EMAIL_TLS_OPTIONS,
};

module.exports = {
    CLIENT_EMAIL_RECIPIENTS,
    MIDNIGHT_REPORT_SUBJECT,
    EMAIL_CONFIG,
    EMAIL_TLS_OPTIONS,
    buildEmailTlsOptions,
    isProductionEnvironment,
};
