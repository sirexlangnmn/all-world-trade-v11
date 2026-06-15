module.exports = (app) => {
    const db = require('../db_models');
    const sequelizeConfig = require('../config/sequelize.config.js');
    const Users_accounts = db.users_accounts;
    const Prospects = db.prospects;
    const Op = db.Sequelize.Op;

    const express = require('express');
    const path = require('path');
    const CryptoJS = require('crypto-js');
    const nodemailer = require('nodemailer');
    const hbs = require('nodemailer-express-handlebars').default;

    app.use(express.static(path.join(__dirname, '../../', 'public')));

    const submitClientEmailToTheTrader = require('../email_controllers/submit-client-email-to-the-trader.controller.js');

    app.post(['/api/v3/post/submit-client-email-to-the-trader'], submitClientEmailToTheTrader.create);

    app.post('/api/post/emails/introduction', async (req, res) => {
        try {
            const records = await getAllProspects();
            records.forEach((record, index) => {
                let receiverEmailAddress = record.email_address;
                if (receiverEmailAddress) {
                    setTimeout(() => {
                        sendIntroductionEmail(receiverEmailAddress, index);
                    }, index * 2000);
                }
            });
        } catch (error) {
            console.error(error);
        }
    });

    app.post('/api/post/emails/notify-trader-on-client-contact', async (req, res) => {
        try {
            const { trader_uuid } = req.body;
            const userUuidEncrypted = req.session.user.uuid;
            const userEmail = req.session.user.email_or_social_media;

            console.log('Trader UUID:', trader_uuid);
            console.log('User UUID (Encrypted):', userUuidEncrypted);
            console.log('User Email:', userEmail);

            const userUuid = decryptUuid(userUuidEncrypted);
            console.log('Decrypted User UUID:', userUuid);

            const traderData = await fetchTraderData(trader_uuid);
            const traderEmail = logTraderData(traderData);

            if (traderEmail) {
                sendEmailToTrader(traderEmail, userEmail);
                sendEmailToClient(userEmail, traderEmail);
                sendEmailToAllWorldTrade(traderEmail, userEmail);

                console.log('Continue with the email notification process');
            } else {
                console.log('Notification process aborted due to missing trader email');
            }
        } catch (error) {
            console.error('Error in notify-trader-on-client-contact:', error);
        }
    });

    async function getAllProspects() {
        try {
            const records = await Prospects.findAll();
            return records;
        } catch (error) {
            console.error(error);
        }
    }

    function sendIntroductionEmail(receiverEmailAddress, index) {
        console.log('Number to be send: ', index);

        // create reusable transporter object using the default SMTP transport
        let transporter = nodemailer.createTransport({
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
            from: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
            to: receiverEmailAddress,
            subject: 'All World Trade - Introduction to AllWorldTrade platform for boosting market and sales',
            template: 'introduction2',
            // context: {
            //     code: verification_code
            // },
        };

        // send mail with defined transport object
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('transporter.sendMail error: ', error);
                // return error;
            } else {
                // res.send('email sent');
                console.log('Email has been sent to: ', receiverEmailAddress);
            }
            // console.log('Message sent info: ', info);
            // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
            // res.render('Email has been sent');
        });
    }

    const decryptUuid = (encryptedUuid) => {
        try {
            return CryptoJS.AES.decrypt(encryptedUuid, process.env.JWT_SECRET).toString(CryptoJS.enc.Utf8);
        } catch (error) {
            console.error('Error decrypting UUID:', error);
            throw new Error('Failed to decrypt UUID');
        }
    };

    const fetchTraderData = async (traderUuid) => {
        try {
            const condition = traderUuid ? { uuid: traderUuid } : null;
            return await Users_accounts.findAll({ where: condition });
        } catch (error) {
            console.error('Error fetching trader data:', error);
            throw new Error('Failed to retrieve trader data');
        }
    };

    const logTraderData = (traderData) => {
        if (traderData && traderData.length > 0) {
            const traderEmail = traderData[0].dataValues.email_or_social_media;
            console.log('Trader email:', traderEmail);
            return traderEmail;
        } else {
            console.log('No trader data found');
            return null;
        }
    };

    function sendEmailToTrader(receiverEmailAddress, emailData) {
        console.log('sendEmailToTrader receiverEmailAddress :', receiverEmailAddress);
        console.log('sendEmailToTrader emailData :', emailData);

        // create reusable transporter object using the default SMTP transport
        let transporter = nodemailer.createTransport({
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
            from: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
            to: receiverEmailAddress,
            subject: 'All World Trade - Client tries to connect.',
            template: 'notifyTraderOnClientContact',
            context: {
                emailData: emailData,
            },
        };

        // send mail with defined transport object
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('transporter.sendMail error: ', error);
                // return error;
            } else {
                // res.send('email sent');
                console.log('Email has been sent to: ', receiverEmailAddress);
            }
            // console.log('Message sent info: ', info);
            // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
            // res.render('Email has been sent');
        });
    }

    function sendEmailToClient(receiverEmailAddress, emailData) {
        // create reusable transporter object using the default SMTP transport
        let transporter = nodemailer.createTransport({
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
            from: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
            to: receiverEmailAddress,
            subject: "All World Trade - Traders you're trying to connect with.",
            template: 'notifyClientOnTraderTheyContact',
            context: {
                emailData: emailData,
            },
        };

        // send mail with defined transport object
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('transporter.sendMail error: ', error);
                // return error;
            } else {
                // res.send('email sent');
                console.log('Email has been sent to: ', receiverEmailAddress);
            }
            // console.log('Message sent info: ', info);
            // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
            // res.render('Email has been sent');
        });
    }

    function sendEmailToAllWorldTrade(traderEmail, clientEmail) {
        const receiverEmailAddress = 'allworldtrade.com@gmail.com';
        // create reusable transporter object using the default SMTP transport
        let transporter = nodemailer.createTransport({
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
            from: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
            to: receiverEmailAddress,
            subject: 'All World Trade - Client trying to connect to a Trader',
            template: 'notifyAWTwhenClientConnectToTrader',
            context: {
                traderEmail: traderEmail,
                clientEmail: clientEmail,
            },
        };

        // send mail with defined transport object
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('transporter.sendMail error: ', error);
                // return error;
            } else {
                // res.send('email sent');
                console.log('Email has been sent to: ', receiverEmailAddress);
            }
            // console.log('Message sent info: ', info);
            // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
            // res.render('Email has been sent');
        });
    }
};
