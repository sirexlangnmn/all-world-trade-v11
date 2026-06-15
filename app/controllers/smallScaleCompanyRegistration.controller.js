const { validationResult } = require('express-validator');
const Controller = require('../models/smallScaleCompanyRegistration.model.js');

// Create and Save a new Controller
exports.create = (req, res) => {};

// ===================
// Create a new object
// ===================
exports.create = (req, res) => {
    // Validate request
    if (!req.body) {
        res.status(400).send({
            message: 'Content can not be empty!',
        });
    }

    // Create a Controller
    const inputData = new Controller({
        session: req.session,

        // users
        first_name: req.body.firstName,
        last_name: req.body.lastName,
        middle_name: req.body.middleName,
        type: 4, // member/user that looking for small scale

        // users_accounts
        email_or_social_media: req.body.emailAddress,
        password: req.body.hashedPassword,

        // users_business_media
        business_social_media_contact_type: req.body.socialMediaContactType,
        business_social_media_contact_number: req.body.socialMediaContactNumber,

        // users_address
        country: req.body.country,
        state_or_province: req.body.states,
        city: req.body.city, //new

        // users_business
        business_language_of_communication: req.body.language,
    });

    // Save Controller in the database
    Controller.create(inputData, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while creating the Model.',
            });
        else res.send(data);
    });
};

// update and Save a new Controller
exports.update = (req, res) => {};

// ===================
// Update a new object
// ===================
exports.update = (req, res) => {
    try {
        const errors = validationResult(req);
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

    // Validate request
    if (!req.body) {
        res.status(400).send({
            message: 'Content can not be empty!',
        });
    }

    // Create a Controller
    const inputData = new Controller({
        uuid: req.session.user.uuid,

        // users
        first_name: req.body.firstName,
        last_name: req.body.lastName,
        middle_name: req.body.middleName,
        type: 4, // member/user that looking for small scale

        // users_accounts
        email_or_social_media: req.body.emailAddress,
        password: req.body.hashedPassword,

        // users_business_media
        business_social_media_contact_type: req.body.socialMediaContactType,
        business_social_media_contact_number: req.body.socialMediaContactNumber,

        // users_address
        country: req.body.country,
        state_or_province: req.body.states,
        city: req.body.city, //new

        // users_business
        business_language_of_communication: req.body.language,
    });

    // Save Controller in the database
    Controller.update(inputData, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while creating the Model.',
            });
        // else res.send(data);
        else res.send('success');
    });
};
