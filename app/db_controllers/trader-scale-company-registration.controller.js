const { v4: uuidV4 } = require('uuid');
const { check, validationResult } = require('express-validator');
const db = require('../db_models');
const sequelizeConfig = require('../config/sequelize.config.js');

const Users_accounts = db.users_accounts;
const Users_address = db.users_address;
// const Users_business = db.users_business;
const Users_business = db.users_businesses;
const Users_business_characteristics = db.users_business_characteristics;
const Users_business_visibility = db.users_business_visibility;
const Users = db.users;

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

    const email_or_social_media = req.body.traderEmailAddress;
    let condition = email_or_social_media ? { email_or_social_media: email_or_social_media } : null;

    const emailExist = await Users_accounts.findAll({ where: condition })
        .then((data) => {
            return data;
        })
        .catch((err) => {
            return err.message || 'Some error occurred while retrieving tutorials.';
        });

    if (emailExist.length > 0) {
        let responseData = {
            message: 'Email already in use',
        };

        res.send(responseData);
    } else {
        let agreeInTermsAndConditions = req.body.agreeInTermsAndConditions;

        if (agreeInTermsAndConditions) {
            //============================================
            // data coming from form submission [start]
            // ===========================================
            // users
            let first_name = req.body.traderGivenNameOfRepresentative;
            let last_name = req.body.traderSurnameOfRepresentative;

            // users_accounts
            let social_media_contact_type = req.body.personalSocialMediaContactNumber;
            let contact_number = req.body.traderCellphone;
            let email_or_social_media = req.body.traderEmailAddress;
            let password = req.body.traderHashedPassword;

            // users_address
            let address = req.body.traderHomeAddress;
            let country = req.body.traderCountryofResidence;
            let state_or_province = req.body.traderCityOfResidence;
            let city = req.body.traderCityOfResidences;

            // users_business
            let business_name = req.body.traderCompanyName;
            let business_email = req.body.traderBusinessEmailAddress;
            let business_contact = req.body.traderBusinessContactNumber;
            let business_language_of_communication = req.body.traderLanguagesOfCommunication;
            let business_tagline = req.body.traderCompanyTagline;
            let start_operating_hour = req.body.traderStartOperatingHour;
            let end_operating_hour = req.body.traderEndOperatingHour;
            // users_business_location
            let business_address = req.body.traderBusinessAddress;
            let business_country = req.body.traderBusinessCountryLocation;
            let business_states = req.body.traderBusinessCityLocation;
            let business_city = req.body.traderBusinessCityLocations;
            // global region of operation
            let region_of_operation = req.body.traderRegionOfOperation;
            let country_of_operation = req.body.traderCountryOfOperation;
            let states_of_operation = req.body.traderStatesOfOperation;
            let city_of_operation = req.body.traderCityOfOperation;
            // users_business_media
            let business_website = req.body.traderWebsite;
            let business_social_media_contact_type = req.body.traderBusinessSocialMediaContactType;
            let business_social_media_contact_number = req.body.traderBusinessSocialMediaContactNumber;

            // users_business_characteristics
            let business_major_category = req.body.traderTradeCategory;
            let business_sub_category = req.body.traderSubCategoryToggleField;
            let business_minor_sub_category = req.body.traderMinorSubCategoryToggleField;
            let textAreaAddKeywords = req.body.textAreaAddKeywords;
            let business_scale = req.body.traderBusinessScale;

            // users_business_visibility
            let i_operate_on_a_world_wide_level = req.body.iOperateOnAWorldWideLevelRadioButton;
            let i_operate_on_a_global_regional_level = req.body.iOperateOnAGlobalRegionalLevelRadioButton;
            let i_operate_on_a_national_level = req.body.iOperateOnANationalLevelRadioButton;
            let i_operate_on_a_state_level = req.body.iOperateOnAStateLevelRadioButton;

            // users_business_visibility
            let visible_to_micro_small_retailers = req.body.traderVisibleToMicroSmallRetailers === undefined ? 0 : 1;
            let visible_to_btb_medium_large_wholesale_highend =
                req.body.traderVisibleToBtbMediumLargeWholesaleHighEnd === undefined ? 0 : 1;
            let visible_to_large_scale_and_highend_business =
                req.body.traderVisibleToLargeScaleAndHighEndBusiness === undefined ? 0 : 1;

            // link
            let link_1 = req.body.link_1;
            let link_2 = req.body.link_2;
            //============================================
            // data coming from form submission [end]
            // ===========================================

            //============================================
            // some data manipulation [start]
            // ===========================================

            let session = req.session;
            let uuid = uuidV4();
            let verificationCode = Math.floor(Math.random() * 900000) + 100000;

            let businessLanguageOfCommunication = business_language_of_communication
                ? business_language_of_communication.toString()
                : '';

            let businessIndustryBelongTo = textAreaAddKeywords.toString();
            // let communicator = link_1 + uuidV4() + link_2;
            let communicator = uuidV4();

            // users_business_visibility
            let iOperateOnWorlWideLevel = i_operate_on_a_world_wide_level === undefined ? 0 : 1;
            let iOperateOnGlobalRegionalLevel = i_operate_on_a_global_regional_level === undefined ? 0 : 1;
            let iOperateOnNationalLevel = i_operate_on_a_national_level === undefined ? 0 : 1;
            let iOperateOnStateLevel = i_operate_on_a_state_level === undefined ? 0 : 1;

            // area of operation
            let regionOfOperation = null;
            let countryOfOperation = null;
            let statesOfOperation = null;
            let cityOfOperation = null;

            let inputRegionOfOperation = region_of_operation;
            let inputCountryOfOperation = country_of_operation;
            let inputStatesOfOperation = states_of_operation;
            let inputCityOfOperation = city_of_operation;

            if (iOperateOnWorlWideLevel == 1) {
                regionOfOperation = null;
                countryOfOperation = null;
                statesOfOperation = null;
                cityOfOperation = null;
            }

            if (iOperateOnGlobalRegionalLevel == 1) {
                if (typeof inputRegionOfOperation === 'string') {
                    regionOfOperation = inputRegionOfOperation;
                }
                if (typeof inputRegionOfOperation === 'object') {
                    regionOfOperation = inputRegionOfOperation.toString();
                }
                if (typeof inputRegionOfOperation === 'undefined') {
                    regionOfOperation = null;
                }
            } else {
                regionOfOperation = null;
            }

            if (iOperateOnNationalLevel == 1) {
                if (typeof inputCountryOfOperation === 'string') {
                    countryOfOperation = inputCountryOfOperation;
                }
                if (typeof inputCountryOfOperation === 'object') {
                    countryOfOperation = inputCountryOfOperation.toString();
                }
                if (typeof inputCountryOfOperation === 'undefined') {
                    countryOfOperation = null;
                }
            } else {
                countryOfOperation = null;
            }

            if (iOperateOnStateLevel == 1) {
                if (typeof inputStatesOfOperation === 'string') {
                    statesOfOperation = inputStatesOfOperation;
                }
                if (typeof inputStatesOfOperation === 'undefined') {
                    statesOfOperation = null;
                }
            } else {
                statesOfOperation = null;
            }

            if (
                iOperateOnWorlWideLevel == 0 &&
                iOperateOnGlobalRegionalLevel == 0 &&
                iOperateOnNationalLevel == 0 &&
                iOperateOnStateLevel == 0
            ) {
                if (typeof inputCityOfOperation === 'string') {
                    cityOfOperation = inputCityOfOperation;
                }
                if (typeof inputCityOfOperation === 'undefined') {
                    cityOfOperation = null;
                }
            } else {
                cityOfOperation = null;
            }

            // sub categories, and minor sub categories
            let businessSubCategoryInt;
            let businessSubCategoryStr;
            let inputBusinessSubCategory = business_sub_category;
            let parsedBusinessSubCategory = parseInt(business_sub_category);

            if (isNaN(parsedBusinessSubCategory)) {
                businessSubCategoryInt = null;
                businessSubCategoryStr = inputBusinessSubCategory;
            } else {
                businessSubCategoryInt = inputBusinessSubCategory;
                businessSubCategoryStr = null;
            }

            let businessMinorSubCategoryInt;
            let businessMinorSubCategoryStr;
            let inputBusinessMinorSubCategory = business_minor_sub_category;
            let parsedBusinessMinorSubCategory = parseInt(business_minor_sub_category);

            if (isNaN(parsedBusinessMinorSubCategory)) {
                businessMinorSubCategoryInt = null;
                businessMinorSubCategoryStr = inputBusinessMinorSubCategory;
            } else {
                businessMinorSubCategoryInt = inputBusinessMinorSubCategory;
                businessMinorSubCategoryStr = null;
            }

            //============================================
            // some data manipulation [end]
            // ===========================================

            const sequelize = sequelizeConfig.sequelize;
            const transaction = await sequelize.transaction();

            try {
                let usersObjects = {
                    first_name: first_name,
                    last_name: last_name,
                    uuid: uuid,
                };

                let usersAccountsObjects = {
                    email_or_social_media: email_or_social_media,
                    social_media_contact_type: social_media_contact_type,
                    contact_number: contact_number,
                    password: password,
                    type: 1, // trader scale company member/user
                    verification_code: verificationCode,
                    uuid: uuid,
                };

                let usersAddressObjects = {
                    address: address,
                    country: country,
                    state_or_province: state_or_province,
                    city: city,
                    uuid: uuid,
                };

                let userBusinessObjects = {
                    business_name: business_name,
                    business_tagline: business_tagline,
                    business_email: business_email,
                    business_contact: business_contact,
                    business_language_of_communication: businessLanguageOfCommunication,
                    business_website: business_website,
                    business_social_media_contact_type: business_social_media_contact_type,
                    business_social_media_contact_number: business_social_media_contact_number,
                    business_address: business_address,
                    business_country: business_country,
                    business_states: business_states,
                    business_city: business_city,
                    region_of_operation: regionOfOperation,
                    country_of_operation: countryOfOperation,
                    states_of_operation: statesOfOperation,
                    city_of_operation: cityOfOperation,
                    start_operating_hour: start_operating_hour,
                    end_operating_hour: end_operating_hour,
                    communicator: communicator,
                    uuid: uuid,
                };

                let usersBusinessCharacteristicsObjects = {
                    business_industry_belong_to: businessIndustryBelongTo,
                    business_major_category: business_major_category,
                    business_sub_category: businessSubCategoryInt,
                    business_sub_category_str: businessSubCategoryStr,
                    business_minor_sub_category: businessMinorSubCategoryInt,
                    business_minor_sub_category_str: businessMinorSubCategoryStr,
                    business_scale: business_scale,
                    uuid: uuid,
                };

                let usersBusinessVisibilityObjects = {
                    i_operate_on_a_world_wide_level: iOperateOnWorlWideLevel,
                    i_operate_on_a_global_regional_level: iOperateOnGlobalRegionalLevel,
                    i_operate_on_a_national_level: iOperateOnNationalLevel,
                    i_operate_on_a_state_level: iOperateOnStateLevel,
                    visible_to_micro_small_retailers: visible_to_micro_small_retailers,
                    visible_to_btb_medium_large_wholesale_highend: visible_to_btb_medium_large_wholesale_highend,
                    visible_to_large_scale_and_highend_business: visible_to_large_scale_and_highend_business,
                    uuid: uuid,
                };

                const user = await Users.create(usersObjects, { transaction: transaction });
                await Users_accounts.create(usersAccountsObjects, { transaction: transaction });
                await Users_address.create(usersAddressObjects, { transaction: transaction });
                await Users_business.create(userBusinessObjects, { transaction: transaction });
                await Users_business_characteristics.create(usersBusinessCharacteristicsObjects, {
                    transaction: transaction,
                });
                await Users_business_visibility.create(usersBusinessVisibilityObjects, { transaction: transaction });

                await transaction.commit();

                session.verification_code = verificationCode;
                session.registration_uuid = uuid;
                session.registration_email_address = req.body.traderEmailAddress;

                let responseData = {
                    message: 'account has been created',
                    uuid: uuid,
                    verification_code: verificationCode,
                    email_or_social_media: req.body.traderEmailAddress,
                };

                res.send(responseData);
            } catch (e) {
                await transaction.rollback();

                let responseData = {
                    message: 'rollback',
                };

                res.send(responseData);
            }
        } else {
            let responseData = {
                message: 'must agree in terms and conditions',
            };

            res.send(responseData);
        }
    }
};
