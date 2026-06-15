const { validationResult } = require('express-validator');
const Controller = require('../models/traderRegistration.model.js');

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
        first_name: req.body.traderGivenNameOfRepresentative,
        last_name: req.body.traderSurnameOfRepresentative,
        type: 1, // trader

        // users_accounts
        social_media_contact_type: req.body.personalSocialMediaContactNumber,
        contact_number: req.body.traderCellphone,
        email_or_social_media: req.body.traderEmailAddress,
        password: req.body.traderHashedPassword,

        // users_address
        address: req.body.traderHomeAddress,
        country: req.body.traderCountryofResidence,
        state_or_province: req.body.traderCityOfResidence,
        city: req.body.traderCityOfResidences, //new

        // users_business
        business_name: req.body.traderCompanyName,
        business_email: req.body.traderBusinessEmailAddress,
        business_contact: req.body.traderBusinessContactNumber,
        business_language_of_communication: req.body.traderLanguagesOfCommunication,
        business_tagline: req.body.traderCompanyTagline,
        start_operating_hour: req.body.traderStartOperatingHour,
        end_operating_hour: req.body.traderEndOperatingHour,
        // users_business_location
        business_address: req.body.traderBusinessAddress,
        business_country: req.body.traderBusinessCountryLocation,
        business_states: req.body.traderBusinessCityLocation,
        business_city: req.body.traderBusinessCityLocations,
        // global region of operation
        region_of_operation: req.body.traderRegionOfOperation,
        country_of_operation: req.body.traderCountryOfOperation,
        states_of_operation: req.body.traderStatesOfOperation,
        city_of_operation: req.body.traderCityOfOperation,
        // users_business_media
        business_website: req.body.traderWebsite,
        business_social_media_contact_type: req.body.traderBusinessSocialMediaContactType,
        business_social_media_contact_number: req.body.traderBusinessSocialMediaContactNumber,

        // users_business_characteristics
        business_major_category: req.body.traderTradeCategory,
        business_sub_category: req.body.traderSubCategoryToggleField,
        business_minor_sub_category: req.body.traderMinorSubCategoryToggleField,
        textAreaAddKeywords: req.body.textAreaAddKeywords,
        business_scale: req.body.traderBusinessScale,

        // users_business_visibility
        i_operate_on_a_world_wide_level: req.body.iOperateOnAWorldWideLevelRadioButton,
        i_operate_on_a_global_regional_level: req.body.iOperateOnAGlobalRegionalLevelRadioButton,
        i_operate_on_a_national_level: req.body.iOperateOnANationalLevelRadioButton,
        i_operate_on_a_state_level: req.body.iOperateOnAStateLevelRadioButton,

        // users_business_visibility
        visible_to_micro_small_retailers: req.body.traderVisibleToMicroSmallRetailers,
        visible_to_btb_medium_large_wholesale_highend: req.body.traderVisibleToBtbMediumLargeWholesaleHighEnd,
        visible_to_large_scale_and_highend_business: req.body.traderVisibleToLargeScaleAndHighEndBusiness,

        // link
        link_1: req.body.link_1,
        link_2: req.body.link_2,
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
