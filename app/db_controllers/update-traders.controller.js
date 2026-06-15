const { v4: uuidV4 } = require('uuid');
const { check, validationResult } = require('express-validator');
const CryptoJS = require('crypto-js');
const JWT_SECRET = process.env.JWT_SECRET;
const db = require('../db_models');
const sequelizeConfig = require('../config/sequelize.config.js');
const Users_business = db.users_businesses;
const Users_business_characteristics = db.users_business_characteristics;
const Users_business_visibility = db.users_business_visibility;
const Op = db.Sequelize.Op;

exports.update = async (req, res) => {
    let uuid = req.session.user.uuid;
    const bytes = CryptoJS.AES.decrypt(uuid, JWT_SECRET);
    const originalUuid = bytes.toString(CryptoJS.enc.Utf8);
    uuid = originalUuid;

    // users_business
    let business_tagline = req.body.tagline;
    let business_website = req.body.website;
    let business_social_media_contact_type = req.body.businessSocialMediaContactType;
    business_social_media_contact_type = business_social_media_contact_type ? business_social_media_contact_type : null;
    let start_operating_hour = req.body.startOperatingHour;
    let end_operating_hour = req.body.endOperatingHour;
    let business_email = req.body.businessEmailAddress;
    let business_contact = req.body.businessContactNumber;
    let editLanguagesOfCommunication = req.body.editLanguagesOfCommunication;
    let uniqueChars = [...new Set(editLanguagesOfCommunication)];
    languages = uniqueChars.toString();
    let business_language_of_communication = languages;

    let business_social_media_contact_number = req.body.businessSocialMediaContactNumber;
    let business_address = req.body.businessAddress;
    let business_country = req.body.editBusinessCountryLocation;
    let business_states = req.body.editBusinessStatesLocation;
    let business_city = req.body.editBusinessCityLocation;

    let region_of_operation = req.body.traderRegionOfOperation;
    let country_of_operation = req.body.traderCountryOfOperation;
    let country_for_state = req.body.traderCountryOfOperation2;
    let states_of_operation = req.body.traderStatesOfOperation;

    let business_major_category = req.body.editTradeCategory;
    let business_sub_category = req.body.subCategorySelect;
    business_sub_category = business_sub_category ? business_sub_category : null;
    let business_sub_category_str = req.body.subCategoryManual;
    business_sub_category_str =
        business_sub_category_str !== undefined && business_sub_category_str !== '' ? business_sub_category_str : null;
    let business_minor_sub_category = req.body.minorSubCategorySelect;
    business_minor_sub_category = business_minor_sub_category ? business_minor_sub_category : null;
    let business_minor_sub_category_str = req.body.minorSubCategoryManual;
    business_minor_sub_category_str =
        business_minor_sub_category_str !== undefined && business_minor_sub_category_str !== ''
            ? business_minor_sub_category_str
            : null;

    let textAreaAddKeywords = req.body.textAreaAddKeywords;
    let business_scale = req.body.editBusinessScale;

    let i_operate_on_a_world_wide_level = req.body.iOperateOnAWorldWideLevelRadioButton === undefined ? 0 : 1;
    let i_operate_on_a_global_regional_level = req.body.iOperateOnAGlobalRegionalLevelRadioButton === undefined ? 0 : 1;
    let i_operate_on_a_national_level = req.body.iOperateOnANationalLevelRadioButton === undefined ? 0 : 1;
    let i_operate_on_a_state_level = req.body.iOperateOnAStateLevelRadioButton === undefined ? 0 : 1;

    if (i_operate_on_a_world_wide_level == 1) {
        region_of_operation = null;
        country_of_operation = null;
        country_for_state = null;
        states_of_operation = null;
        cityOfOperation = null;
    }

    if (i_operate_on_a_global_regional_level == 1) {
        if (typeof region_of_operation === 'string') {
            region_of_operation = region_of_operation;
        }
        if (typeof region_of_operation === 'object') {
            let uniqueChars = [...new Set(region_of_operation)];
            region_of_operation = uniqueChars.toString();
        }
        if (typeof region_of_operation === 'undefined') {
            region_of_operation = null;
        }
    } else {
        region_of_operation = null;
    }

    if (i_operate_on_a_national_level == 1) {
        if (typeof country_of_operation === 'string') {
            country_of_operation = country_of_operation;
        }
        if (typeof country_of_operation === 'object') {
            let uniqueChars = [...new Set(country_of_operation)];
            country_of_operation = uniqueChars.toString();
        }
        if (typeof country_of_operation === 'undefined') {
            country_of_operation = null;
        }
    } else {
        country_of_operation = null;
    }

    if (i_operate_on_a_state_level == 1) {
        if (typeof states_of_operation === 'string') {
            country_for_state = country_for_state;
            states_of_operation = states_of_operation;
        }
        if (typeof states_of_operation === 'undefined') {
            country_for_state = null;
            states_of_operation = null;
        }
    } else {
        country_for_state = null;
        states_of_operation = null;
    }

    const sequelize = sequelizeConfig.sequelize;
    const transaction = await sequelize.transaction();

    try {
        let usersBusinessObjects = {
            business_email: business_email,
            business_contact: business_contact,
            business_language_of_communication: business_language_of_communication,
            business_tagline: business_tagline,
            business_website: business_website,
            business_social_media_contact_type: business_social_media_contact_type,
            business_social_media_contact_number: business_social_media_contact_number,
            business_address: business_address,
            business_country: business_country,
            business_states: business_states,
            business_city: business_city,
            region_of_operation: region_of_operation,
            country_of_operation: country_of_operation,
            country_for_state: country_for_state,
            states_of_operation: states_of_operation,
            start_operating_hour: start_operating_hour,
            end_operating_hour: end_operating_hour,
        };

        let usersBusinessCharacteristicsObjects = {
            business_industry_belong_to: textAreaAddKeywords,
            business_major_category: business_major_category,
            business_sub_category: business_sub_category,
            business_sub_category_str: business_sub_category_str,
            business_minor_sub_category: business_minor_sub_category,
            business_minor_sub_category_str: business_minor_sub_category_str,
            business_scale: business_scale,
        };

        let usersBusinessVisibilityObjects = {
            i_operate_on_a_world_wide_level: i_operate_on_a_world_wide_level,
            i_operate_on_a_global_regional_level: i_operate_on_a_global_regional_level,
            i_operate_on_a_national_level: i_operate_on_a_national_level,
            i_operate_on_a_state_level: i_operate_on_a_state_level,
        };

        let condition = { uuid: uuid };

        console.log('usersBusinessObjects: ', usersBusinessObjects);
        console.log('usersBusinessCharacteristicsObjects: ', usersBusinessCharacteristicsObjects);
        console.log('usersBusinessVisibilityObjects: ', usersBusinessVisibilityObjects);

        const user = await Users_business.update(usersBusinessObjects, {
            where: condition,
            transaction: transaction,
        });
        await Users_business_characteristics.update(usersBusinessCharacteristicsObjects, {
            where: condition,
            transaction: transaction,
        });
        await Users_business_visibility.update(usersBusinessVisibilityObjects, {
            where: condition,
            transaction: transaction,
        });
        await transaction.commit();

        console.log('success');
        res.send('success');
    } catch (e) {
        await transaction.rollback();

        let responseData = {
            message: 'rollback',
        };

        res.send(responseData);
    }
};
