const sql = require('./db.js');
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
    if (model.editLanguagesOfCommunication) {
        let uniqueChars = [...new Set(model.editLanguagesOfCommunication)];
        languages = uniqueChars.toString();
        business_language_of_communication = languages;
    } else {
        business_language_of_communication = model.currentLanguagesOfCommunication;
    }

    let business_industry_belong_to;
    if (model.textAreaAddKeywords) {
        business_industry_belong_to = model.textAreaAddKeywords;
    } else {
        business_industry_belong_to = model.textAreaCurrentKeywords;
    }

    const bytes = CryptoJS.AES.decrypt(model.uuid, JWT_SECRET);
    const originalUuid = bytes.toString(CryptoJS.enc.Utf8);
    this.uuid = originalUuid;

    // users_business
    this.business_tagline = model.business_tagline;
    this.business_website = model.business_website;
    this.business_social_media_contact_type = model.business_social_media_contact_type;
    this.start_operating_hour = model.start_operating_hour;
    this.end_operating_hour = model.end_operating_hour;

    this.business_email = model.business_email;
    this.business_contact = model.business_contact;
    this.business_language_of_communication = business_language_of_communication;
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
    this.i_operate_on_a_world_wide_level = iOperateOnWorlWideLevel;
    this.i_operate_on_a_global_regional_level = iOperateOnGlobalRegionalLevel;
    this.i_operate_on_a_national_level = iOperateOnNationalLevel;
    this.i_operate_on_a_state_level = iOperateOnStateLevel;
};

Model.update = (newModel, result) => {
    /* Begin transaction */
    sql.beginTransaction(function (err) {
        if (err) {
            throw err;
        }

        // users_business
        const usersBusinessData = [
            newModel.business_email,
            newModel.business_contact,
            newModel.business_language_of_communication,
            newModel.business_tagline,
            newModel.business_website,
            newModel.business_social_media_contact_type,
            newModel.business_social_media_contact_number,
            newModel.business_address,
            newModel.business_country,
            newModel.business_states,
            newModel.business_city,
            newModel.region_of_operation,
            newModel.country_of_operation,
            newModel.country_for_state,
            newModel.states_of_operation,
            //newModel.city_of_operation,
            newModel.start_operating_hour,
            newModel.end_operating_hour,
            newModel.uuid,
        ];

        const usersBusinessQuery = `UPDATE users_businesses SET 
            business_email = ?, 
            business_contact = ?, 
            business_language_of_communication = ?, 
            business_tagline = ?, 
            business_website = ?, 
            business_social_media_contact_type = ?, 
            business_social_media_contact_number = ?, 
            business_address = ?, 
            business_country = ?, 
            business_states = ?, 
            business_city = ?, 
            region_of_operation = ?,
            country_of_operation = ?,
            country_for_state = ?,
            states_of_operation = ?,
            start_operating_hour = ?,
            end_operating_hour = ?
            WHERE uuid = ?`;

        sql.query(usersBusinessQuery, usersBusinessData, function (err, rows) {
            if (err) {
                sql.rollback(function () {
                    throw err;
                });
            } else {
                // users_business_characteristics
                const usersBusinessCharacteristicsData = [
                    newModel.business_industry_belong_to,
                    newModel.business_major_category,
                    newModel.business_sub_category,
                    newModel.business_sub_category_str,
                    newModel.business_minor_sub_category,
                    newModel.business_minor_sub_category_str,
                    newModel.business_scale,
                    newModel.uuid,
                ];

                const usersBusinessCharacteristicsQuery = `UPDATE users_business_characteristics SET 
                    business_industry_belong_to = ?, 
                    business_major_category = ?, 
                    business_sub_category = ?, 
                    business_sub_category_str = ?, 
                    business_minor_sub_category = ?, 
                    business_minor_sub_category_str = ?, 
                    business_scale = ? 
                    WHERE uuid = ?`;

                sql.query(usersBusinessCharacteristicsQuery, usersBusinessCharacteristicsData, (err, rows) => {
                    if (err) {
                        sql.rollback(function () {
                            throw err;
                        });
                    } else {
                        // users_business_visibility
                        const usersBusinessVisibilityData = [
                            newModel.i_operate_on_a_world_wide_level,
                            newModel.i_operate_on_a_global_regional_level,
                            newModel.i_operate_on_a_national_level,
                            newModel.i_operate_on_a_state_level,
                            newModel.uuid,
                        ];

                        const usersBusinessVisibilityQuery = `UPDATE users_business_visibilities SET 
                            i_operate_on_a_world_wide_level = ?, 
                            i_operate_on_a_global_regional_level = ?, 
                            i_operate_on_a_national_level = ?, 
                            i_operate_on_a_state_level = ?
                            WHERE uuid = ?`;

                        sql.query(usersBusinessVisibilityQuery, usersBusinessVisibilityData, (err, rows) => {
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
                                        result(null, { id: rows.insertId, ...newModel });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    });
    /* End transaction */
};

module.exports = Model;
