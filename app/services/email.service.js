const nodemailer = require('nodemailer');
const hbs = require('nodemailer-express-handlebars').default;
const path = require('path');
const {
    EMAIL_PROFILES,
    CLIENT_EMAIL_RECIPIENTS,
    MIDNIGHT_REPORT_SUBJECT,
    buildEmailTransportConfig,
} = require('../config/email.config');

const VIEW_PATH = path.resolve('./public/view/email');
const ALL_WORLD_TRADE_EMAIL = 'allworldtrade.com@gmail.com';
const LEGACY_MIDNIGHT_REPORT_SUBJECT = "All World Trade - Traders you're trying to connect with.";

const EMAIL_SUBJECTS = {
    introduction: 'All World Trade - Introduction to AllWorldTrade platform for boosting market and sales',
    traderContact: 'All World Trade - Client tries to connect.',
    clientContact: "All World Trade - Traders you're trying to connect with.",
    allWorldTradeContact: 'All World Trade - Client trying to connect to a Trader',
    clientEmailToTrader: 'All World Trade - Client message you.',
    allWorldTradeClientEmail: 'All World Trade - Client sent a message to a Trader',
    passwordReset: 'Request For Change Password',
    registrationVerification: 'verification subject',
    paymentAccount: 'All World Trade - Trade Show Payment Information',
};

const EMAIL_TEMPLATES = {
    introduction: 'introduction2',
    traderContact: 'notifyTraderOnClientContact',
    clientContact: 'notifyClientOnTraderTheyContact',
    allWorldTradeContact: 'notifyAWTwhenClientConnectToTrader',
    clientEmailToTrader: 'client-email-the-trader',
    allWorldTradeClientEmail: 'notifyAWTwhenClientSentEmailToTrader',
    passwordReset: 'request-for-change-password',
    registrationVerification: 'registration-email-verification',
    paymentAccount: 'payment-account',
    midnightReport: 'midnight-email-report',
};

class EmailService {
    constructor() {
        this.transporters = new Map();
        this.handlebarsConfigured = new Set();
        // Preserve the original startup verification of the support mailbox.
        this.ready = this.verifyTransporter('support');
    }

    getProfile(profileName = 'support') {
        return EMAIL_PROFILES[profileName] || EMAIL_PROFILES.support;
    }

    getTransporter(profileName = 'support') {
        if (!this.transporters.has(profileName)) {
            const transporter = nodemailer.createTransport(buildEmailTransportConfig(profileName));

            this.configureHandlebars(profileName, transporter);
            this.transporters.set(profileName, transporter);
        }

        return this.transporters.get(profileName);
    }

    configureHandlebars(profileName, transporter) {
        if (this.handlebarsConfigured.has(profileName)) return;

        const handlebarOptions = {
            viewEngine: {
                extName: '.handlebars',
                partialsDir: VIEW_PATH,
                defaultLayout: false,
                helpers: {
                    add: (a, b) => a + b,
                },
            },
            viewPath: VIEW_PATH,
            extName: '.handlebars',
        };

        transporter.use('compile', hbs(handlebarOptions));
        this.handlebarsConfigured.add(profileName);
    }

    async verifyTransporter(profileName = 'support') {
        try {
            await this.getTransporter(profileName).verify();
            console.log(`Email transporter verified successfully (${profileName})`);
        } catch (error) {
            console.error(`Email transporter verification failed (${profileName}):`, error.message);
        }
    }

    async sendTemplatedEmail({ profile = 'support', from, to, subject, template, context }) {
        const mailOptions = {
            from: from || this.getProfile(profile).from,
            to,
            subject,
            template,
        };

        if (context !== undefined) {
            mailOptions.context = context;
        }

        return this.sendMail(mailOptions, profile);
    }

    async sendHtmlEmail({ profile = 'support', from, to, subject, html }) {
        return this.sendMail(
            {
                from: from || this.getProfile(profile).from,
                to,
                subject,
                html,
            },
            profile,
        );
    }

    async sendMail(mailOptions, profileName = 'support') {
        return new Promise((resolve, reject) => {
            console.log(`Attempting to send email to ${mailOptions.to}`);

            this.getTransporter(profileName).sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error(`Email send failed to ${mailOptions.to}:`, error.message);
                    reject(error);
                } else {
                    console.log(`Email sent successfully to ${mailOptions.to}`, info.response);
                    resolve(info);
                }
            });
        });
    }

    async sendIntroductionEmail(to) {
        return this.sendTemplatedEmail({
            profile: 'support',
            to,
            subject: EMAIL_SUBJECTS.introduction,
            template: EMAIL_TEMPLATES.introduction,
        });
    }

    async sendTraderContactNotification(to, emailData) {
        return this.sendTemplatedEmail({
            profile: 'support',
            to,
            subject: EMAIL_SUBJECTS.traderContact,
            template: EMAIL_TEMPLATES.traderContact,
            context: { emailData },
        });
    }

    async sendClientContactNotification(to, emailData) {
        return this.sendTemplatedEmail({
            profile: 'support',
            to,
            subject: EMAIL_SUBJECTS.clientContact,
            template: EMAIL_TEMPLATES.clientContact,
            context: { emailData },
        });
    }

    async sendAllWorldTradeContactNotification(traderEmail, clientEmail) {
        return this.sendTemplatedEmail({
            profile: 'support',
            to: ALL_WORLD_TRADE_EMAIL,
            subject: EMAIL_SUBJECTS.allWorldTradeContact,
            template: EMAIL_TEMPLATES.allWorldTradeContact,
            context: { traderEmail, clientEmail },
        });
    }

    async sendClientEmailToTrader(emailData) {
        return this.sendTemplatedEmail({
            profile: 'support',
            to: emailData.traderEmail,
            subject: EMAIL_SUBJECTS.clientEmailToTrader,
            template: EMAIL_TEMPLATES.clientEmailToTrader,
            context: { emailData },
        });
    }

    async sendAllWorldTradeClientEmailNotification(emailData) {
        return this.sendTemplatedEmail({
            profile: 'support',
            to: ALL_WORLD_TRADE_EMAIL,
            subject: EMAIL_SUBJECTS.allWorldTradeClientEmail,
            template: EMAIL_TEMPLATES.allWorldTradeClientEmail,
            context: { emailData },
        });
    }

    async sendPasswordResetEmail({ to, uuid, link }) {
        return this.sendTemplatedEmail({
            profile: 'registration',
            to,
            subject: EMAIL_SUBJECTS.passwordReset,
            template: EMAIL_TEMPLATES.passwordReset,
            context: { code: uuid, link },
        });
    }

    async sendRegistrationVerificationEmail({ to, code }) {
        return this.sendTemplatedEmail({
            profile: 'registration',
            to,
            subject: EMAIL_SUBJECTS.registrationVerification,
            template: EMAIL_TEMPLATES.registrationVerification,
            context: { code },
        });
    }

    async sendPaymentAccountEmail(to) {
        return this.sendTemplatedEmail({
            profile: 'payment',
            to,
            subject: EMAIL_SUBJECTS.paymentAccount,
            template: EMAIL_TEMPLATES.paymentAccount,
        });
    }

    async sendSupportMessage({ senderEmail, senderMessage }) {
        const supportAddress = this.getProfile('support').from;

        return this.sendHtmlEmail({
            profile: 'support',
            from: supportAddress,
            to: supportAddress,
            subject: 'HELP AND SUGGESTIONS from: ' + senderEmail,
            html:
                '<b>SENDER EMAIL: </b>' + ' ' + senderEmail + ' <br>' + '<b>SENDER MESSAGE: </b>' + ' ' + senderMessage,
        });
    }

    async sendMidnightReport(recipientEmail, reportData) {
        return this.sendTemplatedEmail({
            profile: 'support',
            to: recipientEmail,
            subject: MIDNIGHT_REPORT_SUBJECT,
            template: EMAIL_TEMPLATES.midnightReport,
            context: {
                emailData: reportData,
            },
        });
    }

    // Compatibility with app/shared/email-template.js, which historically used
    // this subject for the same midnight-report template.
    async sendLegacyMidnightReport(recipientEmail, reportData) {
        return this.sendTemplatedEmail({
            profile: 'support',
            to: recipientEmail,
            subject: LEGACY_MIDNIGHT_REPORT_SUBJECT,
            template: EMAIL_TEMPLATES.midnightReport,
            context: {
                emailData: reportData,
            },
        });
    }

    async sendMidnightReportToClients(reportData) {
        const sendPromises = CLIENT_EMAIL_RECIPIENTS.map((email) => this.sendMidnightReport(email, reportData));

        const results = await Promise.allSettled(sendPromises);

        const successful = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.filter((r) => r.status === 'rejected').length;

        return {
            total: CLIENT_EMAIL_RECIPIENTS.length,
            successful,
            failed,
            results,
        };
    }
}

const emailService = new EmailService();

module.exports = emailService;
