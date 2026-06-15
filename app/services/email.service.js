const nodemailer = require('nodemailer');
const hbs = require('nodemailer-express-handlebars').default;
const path = require('path');
const { EMAIL_CONFIG, CLIENT_EMAIL_RECIPIENTS, MIDNIGHT_REPORT_SUBJECT } = require('../config/email.config');

class EmailService {
    constructor() {
        this.transporter = this.createTransporter();
        this.configureHandlebars();
        this.verifyTransporter();
    }

    createTransporter() {
        return nodemailer.createTransport(EMAIL_CONFIG);
    }

    configureHandlebars() {
        if (this.handlebarsConfigured) return;

        const handlebarOptions = {
            viewEngine: {
                extName: '.handlebars',
                partialsDir: path.resolve('./public/view/email'),
                defaultLayout: false,
                helpers: {
                    add: (a, b) => a + b,
                },
            },
            viewPath: path.resolve('./public/view/email'),
            extName: '.handlebars',
        };

        this.transporter.use('compile', hbs(handlebarOptions));
        this.handlebarsConfigured = true;
    }

    async verifyTransporter() {
        try {
            await this.transporter.verify();
            console.log('Email transporter verified successfully');
        } catch (error) {
            console.error('Email transporter verification failed:', error.message);
        }
    }

    async sendMidnightReport(recipientEmail, reportData) {
        const mailOptions = {
            from: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
            to: recipientEmail,
            subject: MIDNIGHT_REPORT_SUBJECT,
            template: 'midnight-email-report',
            context: {
                emailData: reportData,
            },
        };

        return this.sendMail(mailOptions);
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

    async sendMail(mailOptions) {
        return new Promise((resolve, reject) => {
            console.log(`Attempting to send email to ${mailOptions.to}`);
            this.transporter.sendMail(mailOptions, (error, info) => {
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
}

const emailService = new EmailService();

module.exports = emailService;
