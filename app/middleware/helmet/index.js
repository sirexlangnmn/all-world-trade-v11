'use strict';

const helmet = require('helmet');

// Resource hosts below are intentionally explicit. They were derived from the
// EJS/JS inventory in public/view and public/assets/js. Add a host only when a
// real resource needs it; never replace these with `*` or `https:`.
const SCRIPT_SRC_HOSTS = Object.freeze([
    'https://code.jquery.com',
    'https://cdnjs.cloudflare.com',
    'https://unpkg.com',
    'https://cdn.jsdelivr.net',
    'https://cdn.tailwindcss.com',
    'https://player.vimeo.com',
    'https://www.google-analytics.com',
]);

const STYLE_SRC_HOSTS = Object.freeze([
    'https://cdnjs.cloudflare.com',
    'https://unpkg.com',
    'https://cdn.jsdelivr.net',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com',
]);

const FONT_SRC_HOSTS = Object.freeze(['https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com']);

const IMG_SRC_HOSTS = Object.freeze([
    'https://flowbite.s3.amazonaws.com',
    'https://flowbite.com',
    'https://img.icons8.com',
    'https://www.youtube.com',
    'https://img.youtube.com',
    'https://i.ytimg.com',
    'https://cdn.tuk.dev',
    'https://allworldtrade.com',
    'https://www.allworldtrade.com',
]);

const CONNECT_SRC_HOSTS = Object.freeze([
    'https://get.geojs.io',
    'https://freegeoip.app',
    'https://www.google-analytics.com',
    'https://meet.allworldtrade.com',
    'https://meet2.allworldtrade.com',
]);

const FRAME_SRC_HOSTS = Object.freeze([
    'https://www.youtube.com',
    'https://youtube.com',
    'https://player.vimeo.com',
    'https://vimeo.com',
]);

/**
 * CSP is report-only until an operator explicitly sets CSP_REPORT_ONLY=false.
 * Report-only keeps production functional while violations are collected after
 * deploy; it is a rollout stage, not the final state.
 */
function isCspReportOnly(env = process.env) {
    const configured = env.CSP_REPORT_ONLY;

    if (configured === undefined || configured === '') return true;

    return configured !== 'false';
}

function isProductionEnvironment(env = process.env) {
    return env.NODE_ENV === 'production';
}

function buildContentSecurityPolicy({ reportOnly = true, isProduction = false } = {}) {
    return {
        reportOnly,
        useDefaults: false,
        directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            objectSrc: ["'none'"],
            scriptSrc: [
                "'self'",
                // Per-request nonce supplied by app/middleware/nonces. Do not
                // replace this with a module-level value.
                (req, res) => `'nonce-${res.locals.cspNonce || ''}'`,
                ...SCRIPT_SRC_HOSTS,
            ],
            // Temporary debt: 175+ existing inline event handlers cannot be
            // nonced. Inline scripts themselves are nonce-protected.
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", ...STYLE_SRC_HOSTS],
            imgSrc: ["'self'", 'data:', 'blob:', ...IMG_SRC_HOSTS],
            fontSrc: ["'self'", 'data:', ...FONT_SRC_HOSTS],
            // ws:/wss: are required by the same-origin Socket.IO connection.
            connectSrc: ["'self'", 'ws:', 'wss:', ...CONNECT_SRC_HOSTS],
            frameSrc: ["'self'", ...FRAME_SRC_HOSTS],
            mediaSrc: ["'self'", 'data:', 'blob:'],
            workerSrc: ["'self'", 'blob:'],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],
            // Local development is plain HTTP. Upgrading requests there would
            // break every asset request, so only enable it in production.
            upgradeInsecureRequests: isProduction ? [] : null,
        },
    };
}

function createHelmetMiddleware(options = {}) {
    const env = options.env || process.env;
    const isProduction = options.isProduction ?? isProductionEnvironment(env);
    const reportOnly = options.reportOnly ?? isCspReportOnly(env);

    return helmet({
        contentSecurityPolicy: buildContentSecurityPolicy({ reportOnly, isProduction }),
        crossOriginEmbedderPolicy: false,
        // HSTS must only be sent over HTTPS. TLS terminates at Nginx in
        // production; local development is plain HTTP.
        hsts: isProduction ? { maxAge: 15552000, includeSubDomains: false, preload: false } : false,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
        // Keep the existing custom Cache-Control middleware as the single
        // source of truth; do not emit a second, conflicting header.
        cacheControl: false,
    });
}

module.exports = createHelmetMiddleware();
module.exports.buildContentSecurityPolicy = buildContentSecurityPolicy;
module.exports.createHelmetMiddleware = createHelmetMiddleware;
module.exports.isCspReportOnly = isCspReportOnly;
module.exports.isProductionEnvironment = isProductionEnvironment;
module.exports.SCRIPT_SRC_HOSTS = SCRIPT_SRC_HOSTS;
module.exports.STYLE_SRC_HOSTS = STYLE_SRC_HOSTS;
module.exports.FONT_SRC_HOSTS = FONT_SRC_HOSTS;
module.exports.IMG_SRC_HOSTS = IMG_SRC_HOSTS;
module.exports.CONNECT_SRC_HOSTS = CONNECT_SRC_HOSTS;
module.exports.FRAME_SRC_HOSTS = FRAME_SRC_HOSTS;
