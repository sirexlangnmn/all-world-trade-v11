const { validationResult } = require('express-validator');
const Controller = require('../models/largeScaleCompanyRegistration.model.js');

// Create and Save a new Controller
exports.create = (req, res) => {};

// ===================
// Create a new object
// ===================
exports.create = (req, res) => {
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

    // // Create a Controller
    const inputData = new Controller({
        session: req.session,

        // users
        first_name: req.body.traderGivenNameOfRepresentative,
        last_name: req.body.traderSurnameOfRepresentative,
        middle_name: req.body.traderMiddleNameOfRepresentative,
        type: 2, // member/user that looking for large scale

        // users_accounts
        social_media_contact_type: req.body.personalSocialMediaContactNumber,
        contact_number: req.body.traderCellphone,
        email_or_social_media: req.body.emailAddress,
        password: req.body.traderHashedPassword,

        // users_address
        country: req.body.traderCountryofResidence,
        state_or_province: req.body.traderCityOfResidence,
        city: req.body.traderCityOfResidences, //new

        // users_business
        business_name: req.body.traderCompanyName,
        business_email: req.body.traderBusinessEmailAddress,
        business_contact: req.body.traderBusinessContactNumber,
        business_language_of_communication: req.body.traderLanguagesOfCommunication,
        business_tagline: req.body.traderCompanyTagline,

        // users_business_media
        business_website: req.body.traderWebsite,
        business_social_media_contact_type: req.body.traderBusinessSocialMediaContactType,
        business_social_media_contact_number: req.body.traderBusinessSocialMediaContactNumber,

        // users_business_location
        business_address: req.body.traderBusinessAddress,
        business_country: req.body.traderBusinessCountryLocation,
        business_states: req.body.traderBusinessCityLocation,
        business_city: req.body.traderBusinessCityLocations, //new

        // users_business_characteristics
        business_major_category: req.body.traderTradeCategory,
        business_sub_category: req.body.traderSubCategoryToggleField,
        business_minor_sub_category: req.body.traderMinorSubCategoryToggleField,
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
