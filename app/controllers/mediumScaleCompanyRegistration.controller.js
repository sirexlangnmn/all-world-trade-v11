const { validationResult } = require('express-validator');
const Controller = require('../models/mediumScaleCompanyRegistration.model.js');

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
        type: 3, // member/user that looking for medium scale

        // users_accounts
        email_or_social_media: req.body.emailAddress,
        social_media_contact_type: req.body.personalSocialMediaContactType,
        contact_number: req.body.personalSocialMediaContactNumber,
        password: req.body.hashedPassword,

        // users_address
        country: req.body.country,
        state_or_province: req.body.states,
        city: req.body.city, //new

        // users_business_media
        business_website: req.body.businessWebsite,
        business_social_media_contact_type: req.body.businessSocialMediaContactType,
        business_social_media_contact_number: req.body.businessSocialMediaContactNumber,

        // users_business
        business_name: req.body.companyName,
        business_email: req.body.businessEmailAddress,
        business_contact: req.body.businessContactNumber,
        business_language_of_communication: req.body.language,

        // users_business_location
        business_country: req.body.businessCountryLocation,
        business_states: req.body.businessStatesLocation,
        business_city: req.body.businessCityLocation, //new
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
