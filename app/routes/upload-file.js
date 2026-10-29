module.exports = (app) => {
    const db = require('../models/db.js');
    const USERS_BUSINESS_MEDIAS = require('../query/users_business_medias.query.js');

    const CryptoJS = require('crypto-js');
    const JWT_SECRET = process.env.JWT_SECRET;

    const express = require('express');
    const path = require('path');
    const nodemailer = require('nodemailer');
    // const hbs = require('nodemailer-express-handlebars');
    const hbs = require('nodemailer-express-handlebars').default;
    const { EMAIL_TLS_OPTIONS } = require('../config/email.config');
    app.use(express.static(path.join(__dirname, '../../', 'public')));

    const createBusinessMediaUpload = require('../middleware/business-media-upload.middleware.js');
    const executeBusinessMediaQuery = require('../utils/business-media-persistence.js');

    const uploadDirectory = path.resolve(__dirname, '../../public/uploads/users_upload_files/');
    const upload = createBusinessMediaUpload(uploadDirectory);
    const runBusinessMediaQuery = (req, res, query, values, callback) =>
        executeBusinessMediaQuery(db, req, res, query, values, callback, { uploadDirectory });

    const {
        REGISTRATION_UPLOAD_ROUTES,
        STANDALONE_UPLOAD_ROUTES,
        UPGRADE_UPLOAD_ROUTES,
        createMediaUploadHandler,
        getUploadFields,
        mapBusinessMedia,
    } = require('../utils/business-media-upload-config.js');

    const handleRegistrationUpload = createMediaUploadHandler({
        buildQuery: USERS_BUSINESS_MEDIAS.buildInsert,
        runBusinessMediaQuery,
    });

    for (const [route, groups] of REGISTRATION_UPLOAD_ROUTES) {
        app.post(route, upload.fields(getUploadFields(groups)), handleRegistrationUpload(groups));
    }
    const handleUpgradeUpload = createMediaUploadHandler({
        buildQuery: (values, req) => USERS_BUSINESS_MEDIAS.buildUpdate(values, req.body.uuid),
        runBusinessMediaQuery,
    });

    app.post('/api/post/registration-no-upload', (req, res) => {
        const inputObject = {
            uuid: req.body.uuid,
            date_created: new Date().toISOString().replace('T', ' ').substr(0, 19),
        };

        const { query, values } = USERS_BUSINESS_MEDIAS.buildInsert(inputObject);
        db.query(query, values, (err, result) => {
            if (err) {
                console.log(err);
            } else {
                res.send('success upload files');
                console.log('success upload files');
            }
        });
    });

    const getUploadUuid = (req, uuidSource) => {
        if (uuidSource === 'body') {
            return req.body.uuid;
        }
        if (uuidSource === 'sessionRaw') {
            return req.session.user.uuid;
        }
        const bytes = CryptoJS.AES.decrypt(req.session.user.uuid, JWT_SECRET);
        return bytes.toString(CryptoJS.enc.Utf8);
    };

    for (const routeConfiguration of STANDALONE_UPLOAD_ROUTES) {
        const { route, groups, operation, uuidSource } = routeConfiguration;
        if (operation === 'upsert') {
            continue;
        }

        const mapValues = (req, routeGroups) => mapBusinessMedia(req, routeGroups, getUploadUuid(req, uuidSource));
        const buildQuery =
            operation === 'insert'
                ? USERS_BUSINESS_MEDIAS.buildInsert
                : (values) => USERS_BUSINESS_MEDIAS.buildUpdate(values, values.uuid);
        const beforeUpload =
            routeConfiguration.beforeUpload === 'registrationEmailVerification'
                ? (req) => registrationEmailVerification(req.body.verification_code, req.body.emailAddress)
                : undefined;
        const handleStandaloneUpload = createMediaUploadHandler({
            buildQuery,
            runBusinessMediaQuery,
            mapValues,
            successResponse: routeConfiguration.successResponse,
            beforeUpload,
        });

        app.post(route, upload.fields(getUploadFields(groups)), handleStandaloneUpload(groups));
    }

    const bannerUploadRoute = STANDALONE_UPLOAD_ROUTES.find(({ operation }) => operation === 'upsert');
    app.post(bannerUploadRoute.route, upload.fields(getUploadFields(bannerUploadRoute.groups)), (req, res) => {
        if (!req.files) {
            console.log('No file upload');
        } else {
            const originalUuid = getUploadUuid(req, 'session');
            const updateQuery = USERS_BUSINESS_MEDIAS.buildUpdate(
                mapBusinessMedia(req, ['banner'], originalUuid),
                originalUuid,
            );
            const insertQuery = USERS_BUSINESS_MEDIAS.buildInsert(mapBusinessMedia(req, ['banner'], originalUuid));

            runBusinessMediaQuery(req, res, USERS_BUSINESS_MEDIAS.SELECT_ROW, [originalUuid], (err, rows) => {
                if (err) {
                    console.log('USERS_BUSINESS_MEDIAS.SELECT_ROW err', err);
                } else {
                    if (rows.length > 0) {
                        runBusinessMediaQuery(req, res, updateQuery.query, updateQuery.values, function (err, result) {
                            if (err) {
                                //throw err;
                                console.log(err);
                            } else {
                                console.log('success update/upload files');
                            }
                        });
                    } else {
                        runBusinessMediaQuery(req, res, insertQuery.query, insertQuery.values, (err, result) => {
                            if (err) {
                                //throw err;
                                console.log(err);
                            } else {
                                console.log('success insert/upload files');
                            }
                        });
                    }
                }
            });
        }
    });

    // ======================================================
    // upgrade to traders upload media files [START]
    // ======================================================

    for (const [route, groups] of UPGRADE_UPLOAD_ROUTES) {
        app.post(route, upload.fields(getUploadFields(groups)), handleUpgradeUpload(groups));
    }

    // upgrade to traders upload media files [END]
    // ======================================================

    app.post('/api/post/registration-email-verification', (req, res) => {
        let verification_code;
        verification_code = req.body.verification_code;
        verification_code = Number(verification_code);
        let receiverEmailAddress = req.body.email_or_social_media;

        // create reusable transporter object using the default SMTP transport
        let transporter = nodemailer.createTransport({
            host: process.env.EMAIL_SERVERHOST,
            port: process.env.EMAIL_PORT,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
            tls: EMAIL_TLS_OPTIONS,
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
            subject: 'verification subject',
            template: 'registration-email-verification',
            context: {
                code: verification_code,
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
            // console.log('Message sent info: ', info);
            // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
            // res.render('Email has been sent');
        });
    });

    app.post('/api/post/resend-email-verification', (req, res) => {
        console.log('req.session sa server resend-email-verification');
        console.log(req.session.verification_code);
        console.log(req.session.registration_uuid);
        console.log(req.session.registration_email_address);

        let verification_code;
        verification_code = req.session.verification_code;
        verification_code = Number(verification_code);
        let receiverEmailAddress = req.session.registration_email_address;

        // create reusable transporter object using the default SMTP transport
        let transporter = nodemailer.createTransport({
            host: process.env.EMAIL_SERVERHOST,
            port: process.env.EMAIL_PORT,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
            tls: EMAIL_TLS_OPTIONS,
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
            subject: 'verification subject',
            template: 'registration-email-verification',
            context: {
                code: verification_code,
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
            // console.log('Message sent info: ', info);
            // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
            // res.render('Email has been sent');
        });
    });

    app.post('/api/post/email-payment-account', (req, res) => {
        console.log('email-payment-account');
        let receiverEmailAddress = req.body.email;

        // create reusable transporter object using the default SMTP transport
        let transporter = nodemailer.createTransport({
            host: process.env.EMAIL_SERVERHOST,
            port: process.env.EMAIL_PORT,
            secure: false,
            auth: {
                user: process.env.PAYMENT_EMAIL_ADDRESS,
                pass: process.env.PAYMENT_EMAIL_ADDRESS_PASSWORD,
            },
            tls: EMAIL_TLS_OPTIONS,
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
            from: process.env.PAYMENT_EMAIL_ADDRESS,
            to: receiverEmailAddress,
            subject: 'All World Trade - Trade Show Payment Information',
            template: 'payment-account',
            // context: {
            //     code: verification_code
            // },
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
            // console.log('Message sent info: ', info);
            // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
            // res.render('Email has been sent');
        });
    });
};
