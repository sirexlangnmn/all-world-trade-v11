const sql = require('./db.js');
const USERS_BUSINESS = require('../query/users_business.query.js');
const USERS_BUSINESS_CHARACTERISTICS = require('../query/users_business_characteristics.query.js');
const CryptoJS = require('crypto-js');
const JWT_SECRET = process.env.JWT_SECRET;

const Model = function (model) {
    let iOperateOnWorlWideLevel = model.i_operate_on_a_world_wide_level === undefined ? 0 : 1;
    let iOperateOnGlobalRegionalLevel = model.i_operate_on_a_global_regional_level === undefined ? 0 : 1;
    let iOperateOnNationalLevel = model.i_operate_on_a_national_level === undefined ? 0 : 1;
    let iOperateOnStateLevel = model.i_operate_on_a_state_level === undefined ? 0 : 1;

    let regionOfOperation = null;
    let countryOfOperation = null;
    let statesOfOperation = null;
    let countryForState = null;
    let cityOfOperation = null;

    let inputRegionOfOperation = model.region_of_operation;
    let inputCountryOfOperation = model.country_of_operation;
    let inputStatesOfOperation = model.states_of_operation;
    let inputCountryForState = model.country_for_state;
    let inputCityOfOperation = model.city_of_operation;

    if (iOperateOnWorlWideLevel == 1) {
        regionOfOperation = null;
        countryOfOperation = null;
        statesOfOperation = null;
        countryForState = null;
        cityOfOperation = null;
    }

    if (iOperateOnGlobalRegionalLevel == 1) {
        if (typeof inputRegionOfOperation === 'string') {
            regionOfOperation = inputRegionOfOperation;
        }
        if (typeof inputRegionOfOperation === 'object') {
            let uniqueChars = [...new Set(inputRegionOfOperation)];
            regionOfOperation = uniqueChars.toString();
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
            let uniqueChars = [...new Set(inputCountryOfOperation)];
            countryOfOperation = uniqueChars.toString();
        }
        if (typeof inputCountryOfOperation === 'undefined') {
            countryOfOperation = null;
        }
    } else {
        countryOfOperation = null;
    }

    if (iOperateOnStateLevel == 1) {
        if (typeof inputStatesOfOperation === 'string') {
            countryForState = inputCountryForState;
            statesOfOperation = inputStatesOfOperation;
        }
        if (typeof inputStatesOfOperation === 'undefined') {
            countryForState = null;
            statesOfOperation = null;
        }
    } else {
        countryForState = null;
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

    let businessSubCategoryInt;
    let businessSubCategoryStr;
    let inputBusinessSubCategory = model.business_sub_category;
    let parsedBusinessSubCategory = parseInt(model.business_sub_category);

    if (isNaN(parsedBusinessSubCategory)) {
        businessSubCategoryInt = null;
        businessSubCategoryStr = inputBusinessSubCategory;
    } else {
        businessSubCategoryInt = inputBusinessSubCategory;
        businessSubCategoryStr = null;
    }

    let businessMinorSubCategoryInt;
    let businessMinorSubCategoryStr;
    let inputBusinessMinorSubCategory = model.business_minor_sub_category;
    let parsedBusinessMinorSubCategory = parseInt(model.business_minor_sub_category);

    if (isNaN(parsedBusinessMinorSubCategory)) {
        businessMinorSubCategoryInt = null;
        businessMinorSubCategoryStr = inputBusinessMinorSubCategory;
    } else {
        businessMinorSubCategoryInt = parsedBusinessMinorSubCategory;
        businessMinorSubCategoryStr = null;
    }

    let business_language_of_communication;
    let business_industry_belong_to;

    if (model.editLanguagesOfCommunication) {
        business_language_of_communication = model.editLanguagesOfCommunication;
    } else {
        business_language_of_communication = model.currentLanguagesOfCommunication;
    }

    if (model.textAreaAddKeywords) {
        business_industry_belong_to = model.textAreaAddKeywords;
    } else {
        business_industry_belong_to = model.textAreaCurrentKeywords;
    }

    this.id = model.id;

    const bytes = CryptoJS.AES.decrypt(model.uuid, JWT_SECRET);
    const originalUuid = bytes.toString(CryptoJS.enc.Utf8);

    this.uuid = originalUuid;
    ((this.type = 1), // traders
        // users_business
        (this.business_name = model.business_name));
    this.business_tagline = model.business_tagline;
    this.business_website = model.business_website;
    this.business_social_media_contact_type = model.business_social_media_contact_type;
    this.start_operating_hour = model.start_operating_hour;
    this.end_operating_hour = model.end_operating_hour;

    this.business_email = model.business_email;
    this.business_contact = model.business_contact;
    this.business_language_of_communication = business_language_of_communication.toString();
    this.business_social_media_contact_number = model.business_social_media_contact_number;
    this.business_address = model.business_address;
    this.business_country = model.business_country;
    this.business_states = model.business_states;
    this.business_city = model.business_city;
    // global region of operation new
    this.region_of_operation = regionOfOperation;
    this.country_of_operation = countryOfOperation;
    this.country_for_state = countryForState;
    this.states_of_operation = statesOfOperation;
    this.city_of_operation = cityOfOperation;

    // users_business_characteristics
    this.business_industry_belong_to = business_industry_belong_to.toString();
    this.business_major_category = model.business_major_category;
    this.business_sub_category = businessSubCategoryInt;
    this.business_sub_category_str = businessSubCategoryStr;
    this.business_minor_sub_category = businessMinorSubCategoryInt;
    this.business_minor_sub_category_str = businessMinorSubCategoryStr;
    this.business_scale = model.business_scale;

    // users_business_visibility
    this.i_operate_on_a_world_wide_level = model.i_operate_on_a_world_wide_level === undefined ? 0 : 1;
    this.i_operate_on_a_global_regional_level = model.i_operate_on_a_global_regional_level === undefined ? 0 : 1;
    this.i_operate_on_a_national_level = model.i_operate_on_a_national_level === undefined ? 0 : 1;
    this.i_operate_on_a_state_level = model.i_operate_on_a_state_level === undefined ? 0 : 1;

    // this.visible_to_your_own_global_region = model.visible_to_your_own_global_region === undefined ? 0 : 1;
    // this.visible_only_to_your_own_country = model.visible_only_to_your_own_country === undefined ? 0 : 1;
    // this.visible_to_your_own_states = model.visible_to_your_own_states === undefined ? 0 : 1;
    // this.visible_to_your_own_city = model.visible_to_your_own_city === undefined ? 0 : 1;
    this.visible_to_micro_small_retailers = model.visible_to_micro_small_retailers === undefined ? 0 : 1;
    this.visible_to_btb_medium_large_wholesale_highend =
        model.visible_to_btb_medium_large_wholesale_highend === undefined ? 0 : 1;
    this.visible_to_large_scale_and_highend_business =
        model.visible_to_large_scale_and_highend_business === undefined ? 0 : 1;

    this.session = model.session;
};

Model.update = (newModel, result) => {
    const usersBusinessObject = {
        business_name: newModel.business_name,
        business_email: newModel.business_email,
        business_contact: newModel.business_contact,
        business_language_of_communication: newModel.business_language_of_communication,
        business_tagline: newModel.business_tagline,
        business_website: newModel.business_website,
        business_social_media_contact_type: newModel.business_social_media_contact_type,
        business_social_media_contact_number: newModel.business_social_media_contact_number,
        business_address: newModel.business_address,
        business_country: newModel.business_country,
        business_states: newModel.business_states,
        business_city: newModel.business_city,
        region_of_operation: newModel.region_of_operation,
        country_of_operation: newModel.country_of_operation,
        country_for_state: newModel.country_for_state,
        states_of_operation: newModel.states_of_operation,
        city_of_operation: newModel.city_of_operation,
        start_operating_hour: newModel.start_operating_hour,
        end_operating_hour: newModel.end_operating_hour,
    };

    // users_accounts ok
    const usersAccountsData = [newModel.type, newModel.uuid];

    const usersAccountsQuery = `UPDATE users_accounts SET 
        type = ?
        WHERE uuid = ?`;

    // users_business_characteristics
    const usersBusinessCharacteristicsObject = {
        business_industry_belong_to: newModel.business_industry_belong_to,
        business_major_category: newModel.business_major_category,
        business_sub_category: newModel.business_sub_category,
        business_sub_category_str: newModel.business_sub_category_str,
        business_minor_sub_category: newModel.business_minor_sub_category,
        business_minor_sub_category_str: newModel.business_minor_sub_category_str,
        business_scale: newModel.business_scale,
    };

    // users_business_visibility
    const usersBusinessVisibilityData = [
        newModel.id,
        newModel.i_operate_on_a_world_wide_level,
        newModel.i_operate_on_a_global_regional_level,
        newModel.i_operate_on_a_national_level,
        newModel.i_operate_on_a_state_level,
        newModel.visible_to_micro_small_retailers,
        newModel.visible_to_btb_medium_large_wholesale_highend,
        newModel.visible_to_large_scale_and_highend_business,
        newModel.uuid,
    ];

    const usersBusinessVisibilityQuery = `INSERT INTO users_business_visibilities
        (user_business_id, 
        i_operate_on_a_world_wide_level, 
        i_operate_on_a_global_regional_level, 
        i_operate_on_a_national_level, 
        i_operate_on_a_state_level, 
        visible_to_micro_small_retailers, 
        visible_to_btb_medium_large_wholesale_highend, 
        visible_to_large_scale_and_highend_business, 
        uuid) 
        VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?, ?);`;

    /* Begin transaction */
    sql.beginTransaction(function (err) {
        if (err) {
            throw err;
        }

        // sql.query(usersBusinessQuery, usersBusinessData, function (err, rows) {
        sql.query(USERS_BUSINESS.UPDATE, [...Object.values(usersBusinessObject), newModel.uuid], function (err, rows) {
            if (err) {
                sql.rollback(function () {
                    throw err;
                });
            } else {
                sql.query(usersAccountsQuery, usersAccountsData, function (err, rows) {
                    if (err) {
                        sql.rollback(function () {
                            throw err;
                        });
                    } else {
                        // sql.query(usersBusinessCharacteristicsQuery, usersBusinessCharacteristicsData, (err, rows) => {
                        sql.query(
                            USERS_BUSINESS_CHARACTERISTICS.UPDATE,
                            [...Object.values(usersBusinessCharacteristicsObject), newModel.uuid],
                            (err, rows) => {
                                if (err) {
                                    sql.rollback(function () {
                                        throw err;
                                    });
                                } else {
                                    sql.query(
                                        usersBusinessVisibilityQuery,
                                        usersBusinessVisibilityData,
                                        (err, rows) => {
                                            if (err) {
                                                sql.rollback(function () {
                                                    throw err;
                                                });
                                            } else {
                                                sql.commit(function (err) {
                                                    if (err) {
                                                        sql.rollback(function () {
                                                            throw err;
                                                        });
                                                    } else {
                                                        newModel.session.user.type = newModel.type;
                                                        result(null, { id: rows.insertId, ...newModel });
                                                    }
                                                });
                                            }
                                        },
                                    );
                                }
                            },
                        );
                    }
                });
            }
        });
    });
    /* End transaction */
};

module.exports = Model;
