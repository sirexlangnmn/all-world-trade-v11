const { v4: uuidV4 } = require('uuid');
const { check, validationResult } = require('express-validator');
const db = require('../db_models');
const emailService = require('../services/email.service.js');
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

    // Keep the historical fire-and-forget behavior; log failures instead of
    // leaving an unhandled promise rejection.
    emailService
        .sendSupportMessage({ senderEmail: sender_email, senderMessage: sender_message })
        .catch((error) => console.error('Support message email failed:', error.message));

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
