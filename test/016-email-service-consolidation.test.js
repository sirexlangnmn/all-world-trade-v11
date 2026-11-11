// Acceptance tests for docs/tasks/016-Duplicated-Email-Transporter-Configuration.md
// (CODE_REVIEW Finding 16 -- duplicated email transporter configuration).
//
// Run: node --test test/016-email-service-consolidation.test.js
//
// These tests are static and never open an SMTP connection or read real
// credentials.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    EMAIL_CONFIG,
    EMAIL_PROFILES,
    EMAIL_TLS_OPTIONS,
    MIDNIGHT_REPORT_SUBJECT,
    buildEmailTransportConfig,
} = require('../app/config/email.config.js');

// Replace the real transport factory before the service is loaded so the
// behaviour tests below exercise the actual service methods without opening an
// SMTP connection or reading real credentials.
const nodemailer = require('nodemailer');
const sentEmails = [];
const createdTransports = [];

nodemailer.createTransport = (config) => {
    const transport = {
        config,
        use() {},
        verify: async () => true,
        sendMail(mailOptions, callback) {
            sentEmails.push({ config, mailOptions });
            callback(null, { response: '250 OK' });
        },
    };

    createdTransports.push(transport);
    return transport;
};

const emailService = require('../app/services/email.service.js');

const PROJECT_ROOT = path.join(__dirname, '..');
const APP_ROOT = path.join(PROJECT_ROOT, 'app');
const EMAIL_VIEW_ROOT = path.join(PROJECT_ROOT, 'public/view/email');

const EXPECTED_TEMPLATES = [
    'client-email-the-trader.handlebars',
    'introduction2.handlebars',
    'midnight-email-report.handlebars',
    'notifyAWTwhenClientConnectToTrader.handlebars',
    'notifyAWTwhenClientSentEmailToTrader.handlebars',
    'notifyClientOnTraderTheyContact.handlebars',
    'notifyTraderOnClientContact.handlebars',
    'payment-account.handlebars',
    'registration-email-verification.handlebars',
    'request-for-change-password.handlebars',
];

const EXPECTED_SUBJECTS = [
    'All World Trade - Introduction to AllWorldTrade platform for boosting market and sales',
    'All World Trade - Client tries to connect.',
    "All World Trade - Traders you're trying to connect with.",
    'All World Trade - Client trying to connect to a Trader',
    'All World Trade - Client message you.',
    'All World Trade - Client sent a message to a Trader',
    'Request For Change Password',
    'verification subject',
    'All World Trade - Trade Show Payment Information',
];

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

function filesMatching(pattern) {
    return sourceFiles()
        .filter(({ source }) => pattern.test(source))
        .map(({ relativePath }) => relativePath)
        .sort();
}

test('only the shared email service creates a Nodemailer transport', () => {
    assert.deepEqual(filesMatching(/nodemailer\.createTransport\s*\(/), ['app/services/email.service.js']);
});

test('only the shared email service configures Handlebars', () => {
    assert.deepEqual(filesMatching(/nodemailer-express-handlebars|hbs\(|\.use\(\s*['"]compile['"]/), [
        'app/services/email.service.js',
    ]);
});

test('every email template still exists under public/view/email', () => {
    for (const template of EXPECTED_TEMPLATES) {
        assert.ok(fs.existsSync(path.join(EMAIL_VIEW_ROOT, template)), `${template} must exist`);
    }
});

test('the email config exposes exactly the three credential profiles', () => {
    assert.deepEqual(Object.keys(EMAIL_PROFILES).sort(), ['payment', 'registration', 'support']);
});

test('each credential profile maps to its original environment variables', () => {
    const fakeEnv = {
        EMAIL_SERVERHOST: 'smtp.example.test',
        EMAIL_PORT: '2525',
        SUPPORT_RECEIVER_EMAIL_ADDRESS: 'support@example.test',
        SUPPORT_RECEIVER_PASSWORD: 'support-secret',
        EMAIL_USER: 'registration@example.test',
        EMAIL_PASSWORD: 'registration-secret',
        EMAIL_SENDER_ADDRESS: 'from-registration@example.test',
        PAYMENT_EMAIL_ADDRESS: 'payment@example.test',
        PAYMENT_EMAIL_ADDRESS_PASSWORD: 'payment-secret',
        NODE_ENV: 'production',
    };

    assert.deepEqual(buildEmailTransportConfig('support', fakeEnv), {
        host: 'smtp.example.test',
        port: 2525,
        secure: false,
        auth: {
            user: 'support@example.test',
            pass: 'support-secret',
        },
        tls: { rejectUnauthorized: true },
    });

    assert.deepEqual(buildEmailTransportConfig('registration', fakeEnv).auth, {
        user: 'registration@example.test',
        pass: 'registration-secret',
    });

    assert.deepEqual(buildEmailTransportConfig('payment', fakeEnv).auth, {
        user: 'payment@example.test',
        pass: 'payment-secret',
    });
});

test('the legacy EMAIL_CONFIG still equals the support profile transport', () => {
    const supportConfig = buildEmailTransportConfig('support');

    assert.equal(EMAIL_CONFIG.auth, supportConfig.auth);
    assert.deepEqual(EMAIL_CONFIG.tls, EMAIL_TLS_OPTIONS);
    assert.equal(EMAIL_CONFIG.secure, false);
});

test('all original subjects and templates remain in the service', () => {
    const source = readSource('app/services/email.service.js');

    for (const subject of EXPECTED_SUBJECTS) {
        assert.ok(source.includes(subject), `service must preserve the subject: ${subject}`);
    }

    for (const template of EXPECTED_TEMPLATES) {
        const templateName = template.replace('.handlebars', '');
        assert.ok(source.includes(`'${templateName}'`), `service must preserve the template: ${templateName}`);
    }
});

test('the legacy email-template exports still delegate to the service', () => {
    const source = readSource('app/shared/email-template.js');

    for (const exportName of [
        'sendEmailToClient',
        'notifyAWTwhenClientSentEmailToTrader',
        'clientEmailTheTrader',
        'sendEmailReportEveryMidnight',
    ]) {
        assert.match(source, new RegExp(`et\\.${exportName}\\s*=`), `et.${exportName} must remain exported`);
    }

    assert.match(source, /sendClientContactNotification/);
    assert.match(source, /sendAllWorldTradeClientEmailNotification/);
    assert.match(source, /sendClientEmailToTrader/);
    assert.match(source, /sendLegacyMidnightReport/);
});

test('routes no longer import Nodemailer or Handlebars directly', () => {
    const emailFiles = [
        'app/routes/email-marketing.js',
        'app/routes/forgot-password.js',
        'app/routes/upload-file.js',
        'app/shared/email-template.js',
        'app/db_controllers/support_messages.controller.js',
    ];

    for (const relativePath of emailFiles) {
        const source = readSource(relativePath);

        assert.doesNotMatch(source, /require\(['"]nodemailer['"]\)/, `${relativePath} must not import nodemailer`);
        assert.doesNotMatch(
            source,
            /require\(['"]nodemailer-express-handlebars['"]\)/,
            `${relativePath} must not import nodemailer-express-handlebars`,
        );
    }
});

test('support messages keep the raw HTML path instead of a template', () => {
    const controller = readSource('app/db_controllers/support_messages.controller.js');
    const service = readSource('app/services/email.service.js');

    assert.match(controller, /sendSupportMessage/);
    assert.match(service, /sendSupportMessage\s*\(/);
    assert.match(service, /sendHtmlEmail\s*\(/);
    assert.match(service, /html:\s*'<b>SENDER EMAIL: <\/b>'/);
});

test('fire-and-forget callers attach rejection handlers', () => {
    const files = [
        'app/routes/email-marketing.js',
        'app/shared/email-template.js',
        'app/db_controllers/support_messages.controller.js',
    ];

    for (const relativePath of files) {
        const source = readSource(relativePath);

        assert.match(source, /\.catch\(/, `${relativePath} must attach a rejection handler to fire-and-forget sends`);
    }
});

test('no email source logs an SMTP password', () => {
    const credentialVariables = ['SUPPORT_RECEIVER_PASSWORD', 'EMAIL_PASSWORD', 'PAYMENT_EMAIL_ADDRESS_PASSWORD'];

    for (const { relativePath, source } of sourceFiles()) {
        for (const variable of credentialVariables) {
            assert.doesNotMatch(
                source,
                new RegExp(`console\\.[a-z]+\\([^\\n]*${variable}`),
                `${relativePath} must not log ${variable}`,
            );
        }
    }
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

// ---------------------------------------------------------------------------
// Behaviour coverage: drive the real service methods through an in-memory
// transport. Nothing here connects to SMTP or logs credentials.
// ---------------------------------------------------------------------------

function resetSentEmails() {
    sentEmails.length = 0;
}

function lastSentEmail() {
    assert.ok(sentEmails.length > 0, 'expected the service to send exactly one email');
    return sentEmails[sentEmails.length - 1];
}

function assertProfile(actualConfig, profileName) {
    assert.equal(actualConfig.auth, emailService.getProfile(profileName).auth);
}

test('introduction email preserves its envelope and has no template context', async () => {
    resetSentEmails();

    await emailService.sendIntroductionEmail('prospect@example.test');

    const { config, mailOptions } = lastSentEmail();

    assert.equal(mailOptions.to, 'prospect@example.test');
    assert.equal(mailOptions.from, emailService.getProfile('support').from);
    assert.equal(
        mailOptions.subject,
        'All World Trade - Introduction to AllWorldTrade platform for boosting market and sales',
    );
    assert.equal(mailOptions.template, 'introduction2');
    assert.equal('context' in mailOptions, false);
    assertProfile(config, 'support');
});

test('trader contact notification preserves its envelope', async () => {
    resetSentEmails();
    const emailData = { clientEmail: 'client@example.test', message: 'hello' };

    await emailService.sendTraderContactNotification('trader@example.test', emailData);

    const { config, mailOptions } = lastSentEmail();

    assert.equal(mailOptions.to, 'trader@example.test');
    assert.equal(mailOptions.from, emailService.getProfile('support').from);
    assert.equal(mailOptions.subject, 'All World Trade - Client tries to connect.');
    assert.equal(mailOptions.template, 'notifyTraderOnClientContact');
    assert.deepEqual(mailOptions.context, { emailData });
    assertProfile(config, 'support');
});

test('client contact notification preserves its envelope', async () => {
    resetSentEmails();
    const emailData = { companyName: 'Acme', message: 'hello' };

    await emailService.sendClientContactNotification('client@example.test', emailData);

    const { config, mailOptions } = lastSentEmail();

    assert.equal(mailOptions.to, 'client@example.test');
    assert.equal(mailOptions.from, emailService.getProfile('support').from);
    assert.equal(mailOptions.subject, "All World Trade - Traders you're trying to connect with.");
    assert.equal(mailOptions.template, 'notifyClientOnTraderTheyContact');
    assert.deepEqual(mailOptions.context, { emailData });
    assertProfile(config, 'support');
});

test('All World Trade contact notification keeps the internal recipient', async () => {
    resetSentEmails();

    await emailService.sendAllWorldTradeContactNotification('trader@example.test', 'client@example.test');

    const { config, mailOptions } = lastSentEmail();

    assert.equal(mailOptions.to, 'allworldtrade.com@gmail.com');
    assert.equal(mailOptions.from, emailService.getProfile('support').from);
    assert.equal(mailOptions.subject, 'All World Trade - Client trying to connect to a Trader');
    assert.equal(mailOptions.template, 'notifyAWTwhenClientConnectToTrader');
    assert.deepEqual(mailOptions.context, {
        traderEmail: 'trader@example.test',
        clientEmail: 'client@example.test',
    });
    assertProfile(config, 'support');
});

test('client-to-trader email is addressed to the trader', async () => {
    resetSentEmails();
    const emailData = { traderEmail: 'trader@example.test', message: 'hello' };

    await emailService.sendClientEmailToTrader(emailData);

    const { config, mailOptions } = lastSentEmail();

    assert.equal(mailOptions.to, 'trader@example.test');
    assert.equal(mailOptions.from, emailService.getProfile('support').from);
    assert.equal(mailOptions.subject, 'All World Trade - Client message you.');
    assert.equal(mailOptions.template, 'client-email-the-trader');
    assert.deepEqual(mailOptions.context, { emailData });
    assertProfile(config, 'support');
});

test('All World Trade client-email notification keeps the internal recipient', async () => {
    resetSentEmails();
    const emailData = { traderEmail: 'trader@example.test', message: 'hello' };

    await emailService.sendAllWorldTradeClientEmailNotification(emailData);

    const { config, mailOptions } = lastSentEmail();

    assert.equal(mailOptions.to, 'allworldtrade.com@gmail.com');
    assert.equal(mailOptions.from, emailService.getProfile('support').from);
    assert.equal(mailOptions.subject, 'All World Trade - Client sent a message to a Trader');
    assert.equal(mailOptions.template, 'notifyAWTwhenClientSentEmailToTrader');
    assert.deepEqual(mailOptions.context, { emailData });
    assertProfile(config, 'support');
});

test('password reset email uses the registration profile and original context', async () => {
    resetSentEmails();

    await emailService.sendPasswordResetEmail({
        to: 'user@example.test',
        uuid: 'reset-code',
        link: 'https://example.test/reset-password/reset-code',
    });

    const { config, mailOptions } = lastSentEmail();

    assert.equal(mailOptions.to, 'user@example.test');
    assert.equal(mailOptions.from, emailService.getProfile('registration').from);
    assert.equal(mailOptions.subject, 'Request For Change Password');
    assert.equal(mailOptions.template, 'request-for-change-password');
    assert.deepEqual(mailOptions.context, {
        code: 'reset-code',
        link: 'https://example.test/reset-password/reset-code',
    });
    assertProfile(config, 'registration');
});

test('registration verification uses the registration profile and preserves the code value', async () => {
    resetSentEmails();

    await emailService.sendRegistrationVerificationEmail({ to: 'user@example.test', code: 123456 });

    const { config, mailOptions } = lastSentEmail();

    assert.equal(mailOptions.to, 'user@example.test');
    assert.equal(mailOptions.from, emailService.getProfile('registration').from);
    assert.equal(mailOptions.subject, 'verification subject');
    assert.equal(mailOptions.template, 'registration-email-verification');
    assert.deepEqual(mailOptions.context, { code: 123456 });
    assertProfile(config, 'registration');
});

test('payment email uses the payment profile', async () => {
    resetSentEmails();

    await emailService.sendPaymentAccountEmail('buyer@example.test');

    const { config, mailOptions } = lastSentEmail();

    assert.equal(mailOptions.to, 'buyer@example.test');
    assert.equal(mailOptions.from, emailService.getProfile('payment').from);
    assert.equal(mailOptions.subject, 'All World Trade - Trade Show Payment Information');
    assert.equal(mailOptions.template, 'payment-account');
    assert.equal('context' in mailOptions, false);
    assertProfile(config, 'payment');
});

test('support message stays raw HTML without a template property', async () => {
    resetSentEmails();

    await emailService.sendSupportMessage({
        senderEmail: 'sender@example.test',
        senderMessage: 'Please help',
    });

    const { config, mailOptions } = lastSentEmail();

    assert.equal(mailOptions.to, emailService.getProfile('support').from);
    assert.equal(mailOptions.from, emailService.getProfile('support').from);
    assert.equal(mailOptions.subject, 'HELP AND SUGGESTIONS from: sender@example.test');
    assert.equal('template' in mailOptions, false);
    assert.equal(mailOptions.html, '<b>SENDER EMAIL: </b> sender@example.test <br><b>SENDER MESSAGE: </b> Please help');
    assertProfile(config, 'support');
});

test('midnight report preserves its subject and template', async () => {
    resetSentEmails();
    const reportData = { visitors: [], businesses: [] };

    await emailService.sendMidnightReport('report@example.test', reportData);

    const { config, mailOptions } = lastSentEmail();

    assert.equal(mailOptions.to, 'report@example.test');
    assert.equal(mailOptions.subject, MIDNIGHT_REPORT_SUBJECT);
    assert.equal(mailOptions.template, 'midnight-email-report');
    assert.deepEqual(mailOptions.context, { emailData: reportData });
    assertProfile(config, 'support');
});

test('legacy midnight helper preserves its historical subject', async () => {
    resetSentEmails();
    const reportData = { visitors: [] };

    await emailService.sendLegacyMidnightReport('report@example.test', reportData);

    const { mailOptions } = lastSentEmail();

    assert.equal(mailOptions.to, 'report@example.test');
    assert.equal(mailOptions.subject, "All World Trade - Traders you're trying to connect with.");
    assert.equal(mailOptions.template, 'midnight-email-report');
    assert.deepEqual(mailOptions.context, { emailData: reportData });
});

test('transporters are created once per profile and reused', async () => {
    emailService.getTransporter('support');
    const createdBefore = createdTransports.length;

    await emailService.sendIntroductionEmail('one@example.test');
    await emailService.sendClientContactNotification('two@example.test', {});

    assert.equal(createdTransports.length, createdBefore, 'support sends must reuse the cached transporter');
    assert.equal(emailService.transporters.get('support'), emailService.getTransporter('support'));
});

test('missing profile environment variables stay undefined instead of falling back', () => {
    const registration = buildEmailTransportConfig('registration', { EMAIL_SERVERHOST: 'smtp.example.test' });

    assert.equal(registration.auth.user, undefined);
    assert.equal(registration.auth.pass, undefined);
    assert.equal(registration.port, 587);
    assert.equal(registration.tls.rejectUnauthorized, true);

    const payment = buildEmailTransportConfig('payment', { EMAIL_SERVERHOST: 'smtp.example.test' });

    assert.equal(payment.auth.user, undefined);
    assert.equal(payment.auth.pass, undefined);
});

test('unknown profile names resolve to the support profile', () => {
    const fakeEnv = {
        EMAIL_SERVERHOST: 'smtp.example.test',
        SUPPORT_RECEIVER_EMAIL_ADDRESS: 'support@example.test',
        SUPPORT_RECEIVER_PASSWORD: 'support-secret',
        EMAIL_USER: 'registration@example.test',
        EMAIL_PASSWORD: 'registration-secret',
    };

    const config = buildEmailTransportConfig('does-not-exist', fakeEnv);

    assert.deepEqual(config.auth, {
        user: 'support@example.test',
        pass: 'support-secret',
    });
});

test('production cannot disable TLS for any credential profile', () => {
    const env = {
        NODE_ENV: 'production',
        EMAIL_TLS_REJECT_UNAUTHORIZED: 'false',
        EMAIL_SERVERHOST: 'smtp.example.test',
    };

    for (const profileName of ['support', 'registration', 'payment']) {
        assert.equal(buildEmailTransportConfig(profileName, env).tls.rejectUnauthorized, true);
    }
});

test('send failures reject to the caller instead of hanging', async () => {
    const transport = emailService.getTransporter('support');
    const originalSendMail = transport.sendMail;

    transport.sendMail = (mailOptions, callback) => callback(new Error('smtp unavailable'));

    try {
        await assert.rejects(emailService.sendIntroductionEmail('nobody@example.test'), /smtp unavailable/);
    } finally {
        transport.sendMail = originalSendMail;
    }
});
