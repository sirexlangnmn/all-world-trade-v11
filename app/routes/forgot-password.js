module.exports = (app) => {
    const db = require('../models/db.js');
    const db_models = require('../db_models');
    const USERS_ACCOUNTS = require('../query/users_accounts.query.js');
    const RESET_TOKENS = require('../query/reset_tokens.query.js');
    const { PasswordResetService } = require('../services/password-reset.service.js');
    const middleware = require('../middleware');

    const passwordResetService = new PasswordResetService();
    const {
        createResetTokenLimiter,
        sendResetEmailLimiter,
        resetPasswordPageLimiter,
        resetPasswordSubmitLimiter,
    } = middleware.passwordResetRateLimit;

    const express = require('express');
    const path = require('path');
    const nodemailer = require('nodemailer');
    // const hbs = require('nodemailer-express-handlebars');
    const hbs = require('nodemailer-express-handlebars').default;
    app.use(express.static(path.join(__dirname, '../../', 'public')));

    const mysql = require('mysql2');
    const { v4: uuidV4 } = require('uuid');
    const Sequelize = require('sequelize');
    const Op = Sequelize.Op;

    const AWT_HOSTNAME = process.env.AWT_HOSTNAME;

    const INVALID_RESET_TOKEN_MESSAGE = 'Invalid or expired reset token';
    const RESET_PASSWORD_SUCCESS_MESSAGE = 'reset password successfully';
    const RESET_PASSWORD_FAILURE_MESSAGE = 'reset password failed';

    // Database connection
    // const db = mysql.createConnection({
    //     host: process.env.DB_SERVERHOST,
    //     user: process.env.DB_USERNAME,
    //     password: process.env.DB_PASSWORD,
    //     database: process.env.DB_NAME,
    // });

    // db.connect(function (err) {
    //     if (err) {
    //         return console.error('error: ' + err.message);
    //     }
    //     console.log('Connected to the MySQL server.');
    // });

    app.get(['/forgot-password'], (req, res) => {
        res.render(path.join(__dirname, '../../', 'public/view/forgot-password/index'));
    });

    app.post('/api/post/create-reset-token', createResetTokenLimiter, async function (req, res, next) {
        const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

        const { uuid, email_or_social_media: receiverEmailAddress } = req.body;

        // A fresh UUID v4 is the reset token. Nothing credential-related is
        // accepted, derived, or embedded here.
        function buildResetTokenData() {
            const token = uuidV4();
            const link = AWT_HOSTNAME + `reset-password/${token}`;
            const datetime = currentDatetime();

            const resetToken = {
                token,
                expiration: new Date(new Date().getTime() + RESET_TOKEN_TTL_MS),
                uuid,
                createdAt: datetime,
                updatedAt: datetime,
            };

            const response = {
                message: 'reset tokens saved',
                uuid,
                link,
                receiverEmailAddress,
            };

            return { resetToken, response };
        }

        const { resetToken, response } = buildResetTokenData();

        db.query(RESET_TOKENS.CREATE, Object.values(resetToken), (err, rows) => {
            if (err) {
                console.log(err);
            } else {
                res.send(response);
                return;
            }
        });
    });

    app.post('/api/post/send-email-for-change-password', sendResetEmailLimiter, (req, res) => {
        let uuid = req.body.uuid;
        let link = req.body.link;
        let receiverEmailAddress = req.body.receiverEmailAddress;

        // create reusable transporter object using the default SMTP transport
        let transporter = nodemailer.createTransport({
            host: process.env.EMAIL_SERVERHOST,
            port: process.env.EMAIL_PORT,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
            tls: {
                rejectUnauthorized: false,
            },
        });

        const handlebarOptions = {
            viewEngine: {
                extName: '.handlebars',
                partialsDir: path.resolve('./public/view/email'),
                defaultLayout: false,
            },
            viewPath: path.resolve('./public/view/email'),
            extName: '.handlebars',
        };

        transporter.use('compile', hbs(handlebarOptions));

        // setup email data with unicode symbols
        let mailOptions = {
            from: process.env.EMAIL_SENDER_ADDRESS,
            to: receiverEmailAddress,
            subject: 'Request For Change Password',
            template: 'request-for-change-password',
            context: {
                code: uuid,
                link: link,
            },
        };

        // send mail with defined transport object
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
                // return error;
            } else {
                res.send('email sent');
                console.log('Email has been sent');
            }
        });
    });

    User = (req, res) => {
        let email = req.where.email;

        return new Promise((resolve, reject) => {
            db.query(USERS_ACCOUNTS.GET_BY_EMAIL, [email], (error, elements) => {
                if (error) {
                    return reject(error);
                }
                return resolve(elements);
            });
        });
    };

    function isNonEmptyString(value) {
        return typeof value === 'string' && value.length > 0;
    }

    // A token is only usable before its stored expiration. A missing or
    // unparseable expiration fails closed so old/partial rows cannot be used.
    function isResetTokenExpired(resetToken) {
        const expiresAt = new Date(resetToken.expiration).getTime();

        return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
    }

    // Both reset handlers need the same validity decision: the token must be a
    // non-empty string, exist, be unexpired, and map to an account. Returning
    // both records lets the POST handler delete the token after a successful
    // reset. Invalid input always resolves to null; callers own the response.
    async function findUserAccountByResetToken(token) {
        if (!isNonEmptyString(token)) {
            return null;
        }

        const resetToken = await db_models.reset_tokens.findOne({
            where: { token: token },
        });

        if (!resetToken || isResetTokenExpired(resetToken)) {
            return null;
        }

        const userAccount = await db_models.users_accounts.findOne({
            where: { uuid: resetToken.uuid },
        });

        if (!userAccount) {
            return null;
        }

        return { resetToken, userAccount };
    }

    app.get(['/reset-password/:token'], resetPasswordPageLimiter, async function (req, res, next) {
        const result = await findUserAccountByResetToken(req.params.token);

        if (!result) {
            return res.status(404).send(INVALID_RESET_TOKEN_MESSAGE);
        }

        try {
            res.render(path.join(__dirname, '../../', 'public/view/reset-password/index'), {
                email: result.userAccount.email_or_social_media,
            });
        } catch (error) {
            res.send(error.message);
        }
    });

    app.post(['/reset-password/:token'], resetPasswordSubmitLimiter, async function (req, res) {
        const token = req.params.token;
        const { password, password2 } = req.body;
        const result = await findUserAccountByResetToken(token);

        if (!result) {
            return res.send(RESET_PASSWORD_FAILURE_MESSAGE);
        }

        try {
            await passwordResetService.setNewPassword(result.userAccount.uuid, { password, password2 });

            // Only after the password is updated: make the token single-use.
            // A deletion failure must not report success, because the link
            // could still be reused.
            await db_models.reset_tokens.destroy({ where: { token: token } });

            return res.send(RESET_PASSWORD_SUCCESS_MESSAGE);
        } catch (error) {
            console.error('Password reset failed:', error.message);
            return res.send(RESET_PASSWORD_FAILURE_MESSAGE);
        }
    });

    function currentDatetime() {
        let date = new Date();
        let current_date = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
        let current_time = date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
        let date_time = current_date + ' ' + current_time;
        return date_time;
    }
};
