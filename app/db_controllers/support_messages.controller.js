const { v4: uuidV4 } = require('uuid');
const { check, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const db = require('../db_models');
const sequelizeConfig = require('../config/sequelize.config.js');

const Support_messages = db.support_messages;

const Op = db.Sequelize.Op;

exports.create = async (req, res) => {
    const errors = validationResult(req);

    try {
        if (!errors.isEmpty()) {
            return res.status(200).send({
                message: errors.array(),
            });
        }
    } catch (error) {
        return res.status(400).json({
            error: {
                message: error,
            },
        });
    }

    let sender_email = req.body.eihaslna_email_address;
    let sender_message = req.body.eihaslna_message;

    let dataObjects = {
        email_address: sender_email,
        messages: sender_message,
    };

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

    // setup email data with unicode symbols
    let mailOptions = {
        from: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
        to: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
        subject: 'HELP AND SUGGESTIONS from: ' + sender_email,
        template: 'HELP AND SUGGESTIONS from: ' + sender_email,
        // text: "Hello world?", // plain text body
        html: '<b>SENDER EMAIL: </b>' + ' ' + sender_email + ' <br>' + '<b>SENDER MESSAGE: </b>' + ' ' + sender_message,
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
            // res.send('email sent');
            console.log('Email has been sent');
        }
        // console.log('Message sent info: ', info);
        // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        // res.render('Email has been sent');
    });

    Support_messages.create(dataObjects)
        .then((data) => {
            // res.send(data);
            let responseData = {
                message: 'message has been submitted successfully',
            };

            res.send(responseData);
        })
        .catch((err) => {
            res.status(500).send({
                message: err.message || 'Some error occurred while submitting message',
            });
        });
};
