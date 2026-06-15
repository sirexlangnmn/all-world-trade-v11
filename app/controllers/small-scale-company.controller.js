const { validationResult } = require('express-validator');
const Model = require('../models/small-scale-company.model.js');

exports.update = (req, res) => {};

exports.update = (req, res) => {
    // Validate request
    if (!req.body) {
        res.status(400).send({
            message: 'Content can not be empty!',
        });
    }

    const inputData = new Model({
        uuid: req.session.user.uuid,

        // users
        first_name: req.body.firstName,
        last_name: req.body.lastName,
        middle_name: req.body.middleName,
        //type: 4, // member or user that looking for small scale

        // users_address
        country: req.body.country,
        state_or_province: req.body.states,
        city: req.body.city,

        // users_accounts
        // email_or_social_media: req.body.emailAddress,  // Note: email update is not valid in this module. If update email is necessary, need new module with email verification for new email address.
        // password: req.body.hashedPassword, // same, need new module for change password

        // users_accounts
        social_media_contact_type: req.body.socialMediaContactType,
        contact_number: req.body.socialMediaContactNumber,

        // users_business
        // business_language_of_communication: req.body.language,
        editLanguagesOfCommunication: req.body.language, // new language of communication
        currentLanguagesOfCommunication: req.body.currentLanguagesOfCommunication, // current language of communication
    });

    Model.update(inputData, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while creating the Model.',
            });
        // else res.send(data);
        else res.send('success');
    });
};
