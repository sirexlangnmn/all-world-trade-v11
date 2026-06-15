const CLIENT_EMAIL_RECIPIENTS = ['matrixcreationmarketing@gmail.com', 'allworldtrade.com@gmail.com', 'potolin.federex@gmail.com'];

const MIDNIGHT_REPORT_SUBJECT = 'All World Trade - Daily Activity Report';

const EMAIL_CONFIG = {
    host: process.env.EMAIL_SERVERHOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
        pass: process.env.SUPPORT_RECEIVER_PASSWORD,
    },
    tls: {
        rejectUnauthorized: false,
    },
};

module.exports = {
    CLIENT_EMAIL_RECIPIENTS,
    MIDNIGHT_REPORT_SUBJECT,
    EMAIL_CONFIG,
};
