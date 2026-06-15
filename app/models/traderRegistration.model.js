const sql = require('./db.js');
const { v4: uuidV4 } = require('uuid');
const USERS = require('../query/users.query.js');
const USERS_ACCOUNTS = require('../query/users_accounts.query.js');
const USERS_ADDRESS = require('../query/users_address.query.js');
const USERS_BUSINESS = require('../query/users_business.query.js');
const USERS_BUSINESS_CHARACTERISTICS = require('../query/users_business_characteristics.query.js');
const USERS_BUSINESS_VISIBILITY = require('../query/users_business_visibility.query.js');

const Model = function (model) {
    this.communicator = model.link_1 + uuidV4() + model.link_2;

    let iOperateOnWorlWideLevel = model.i_operate_on_a_world_wide_level === undefined ? 0 : 1;
    let iOperateOnGlobalRegionalLevel = model.i_operate_on_a_global_regional_level === undefined ? 0 : 1;
    let iOperateOnNationalLevel = model.i_operate_on_a_national_level === undefined ? 0 : 1;
    let iOperateOnStateLevel = model.i_operate_on_a_state_level === undefined ? 0 : 1;

    let regionOfOperation = null;
    let countryOfOperation = null;
    let statesOfOperation = null;
    let cityOfOperation = null;

    let inputRegionOfOperation = model.region_of_operation;
    let inputCountryOfOperation = model.country_of_operation;
    let inputStatesOfOperation = model.states_of_operation;
    let inputCityOfOperation = model.city_of_operation;

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
        businessMinorSubCategoryInt = inputBusinessMinorSubCategory;
        businessMinorSubCategoryStr = null;
    }

    // users
    this.first_name = model.first_name;
    this.last_name = model.last_name;
    this.uuid = uuidV4();

    // users_accounts
    this.social_media_contact_type = model.social_media_contact_type;
    this.contact_number = model.contact_number;
    this.email_or_social_media = model.email_or_social_media;
    this.password = model.password;
    this.type = model.type;
    this.verification_code = Math.floor(Math.random() * 900000) + 100000;

    // users_address
    this.address = model.address;
    this.country = model.country;
    this.state_or_province = model.state_or_province;
    this.city = model.city;

    // users_business
    this.business_name = model.business_name;
    this.business_email = model.business_email;
    this.business_contact = model.business_contact;
    this.business_language_of_communication = model.business_language_of_communication.toString();
    this.business_tagline = model.business_tagline;
    this.start_operating_hour = model.start_operating_hour;
    this.end_operating_hour = model.end_operating_hour;
    // users_business_location
    this.business_address = model.business_address;
    this.business_country = model.business_country;
    this.business_states = model.business_states;
    this.business_city = model.business_city;
    // global region of operation
    this.region_of_operation = regionOfOperation;
    this.country_of_operation = countryOfOperation;
    this.states_of_operation = statesOfOperation;
    this.city_of_operation = cityOfOperation;
    // users_business_media
    this.business_website = model.business_website;
    this.business_social_media_contact_type = model.business_social_media_contact_type;
    this.business_social_media_contact_number = model.business_social_media_contact_number;

    // users_business_characteristics
    this.business_industry_belong_to = model.textAreaAddKeywords.toString();
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

    this.visible_to_micro_small_retailers = model.visible_to_micro_small_retailers === undefined ? 0 : 1;
    this.visible_to_btb_medium_large_wholesale_highend =
        model.visible_to_btb_medium_large_wholesale_highend === undefined ? 0 : 1;
    this.visible_to_large_scale_and_highend_business =
        model.visible_to_large_scale_and_highend_business === undefined ? 0 : 1;

    this.session = model.session;
};

Model.create = (newModel, result) => {
    /* Begin transaction */
    sql.beginTransaction(function (err) {
        if (err) {
            throw err;
        }

        const usersObject = {
            first_name: newModel.first_name,
            last_name: newModel.last_name,
            uuid: newModel.uuid,
        };

        sql.query(USERS.CREATE, Object.values(usersObject), function (err, rows) {
            if (err) {
                sql.rollback(function () {
                    throw err;
                });
            } else {
                // users_accounts
                const usersAccountsObject = {
                    user_id: rows.insertId,
                    social_media_contact_type: newModel.social_media_contact_type,
                    contact_number: newModel.contact_number,
                    email_or_social_media: newModel.email_or_social_media,
                    password: newModel.password,
                    type: newModel.type,
                    verification_code: newModel.verification_code,
                    uuid: newModel.uuid,
                };

                // users_address
                const usersAddressObject = {
                    user_id: rows.insertId,
                    address: newModel.address,
                    country: newModel.country,
                    state_or_province: newModel.state_or_province,
                    city: newModel.city,
                    uuid: newModel.uuid,
                };

                // users_business
                const usersBusinessObject = {
                    user_id: rows.insertId,
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
                    states_of_operation: newModel.states_of_operation,
                    city_of_operation: newModel.city_of_operation,
                    start_operating_hour: newModel.start_operating_hour,
                    end_operating_hour: newModel.end_operating_hour,
                    communicator: newModel.communicator,
                    uuid: newModel.uuid,
                };

                // users_business_characteristics
                const usersBusinessCharacteristicsObject = {
                    user_business_id: rows.insertId,
                    business_industry_belong_to: newModel.business_industry_belong_to,
                    business_major_category: newModel.business_major_category,
                    business_sub_category: newModel.business_sub_category,
                    business_sub_category_str: newModel.business_sub_category_str,
                    business_minor_sub_category: newModel.business_minor_sub_category,
                    business_minor_sub_category_str: newModel.business_minor_sub_category_str,
                    business_scale: newModel.business_scale,
                    uuid: newModel.uuid,
                };

                // users_business_visibility
                const usersBusinessVisibilityObject = {
                    user_business_id: rows.insertId,
                    i_operate_on_a_world_wide_level: newModel.i_operate_on_a_world_wide_level,
                    i_operate_on_a_global_regional_level: newModel.i_operate_on_a_global_regional_level,
                    i_operate_on_a_national_level: newModel.i_operate_on_a_national_level,
                    i_operate_on_a_state_level: newModel.i_operate_on_a_state_level,
                    visible_to_micro_small_retailers: newModel.visible_to_micro_small_retailers,
                    visible_to_btb_medium_large_wholesale_highend:
                        newModel.visible_to_btb_medium_large_wholesale_highend,
                    visible_to_large_scale_and_highend_business: newModel.visible_to_large_scale_and_highend_business,
                    uuid: newModel.uuid,
                };

                sql.query(USERS_ACCOUNTS.CREATE, Object.values(usersAccountsObject), (err, rows) => {
                    if (err) {
                        sql.rollback(function () {
                            throw err;
                        });
                    } else {
                        sql.query(USERS_ADDRESS.CREATE, Object.values(usersAddressObject), (err, rows) => {
                            if (err) {
                                sql.rollback(function () {
                                    throw err;
                                });
                            } else {
                                sql.query(
                                    USERS_BUSINESS.CREATE,
                                    Object.values(usersBusinessObject),
                                    function (err, rows) {
                                        if (err) {
                                            sql.rollback(function () {
                                                throw err;
                                            });
                                        } else {
                                            sql.query(
                                                USERS_BUSINESS_CHARACTERISTICS.CREATE,
                                                Object.values(usersBusinessCharacteristicsObject),
                                                (err, rows) => {
                                                    if (err) {
                                                        sql.rollback(function () {
                                                            throw err;
                                                        });
                                                    } else {
                                                        sql.query(
                                                            USERS_BUSINESS_VISIBILITY.CREATE,
                                                            Object.values(usersBusinessVisibilityObject),
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
                                                                            newModel.session.verification_code =
                                                                                newModel.verification_code;
                                                                            newModel.session.registration_uuid =
                                                                                newModel.uuid;
                                                                            newModel.session.registration_email_address =
                                                                                newModel.email_or_social_media;
                                                                            result(null, {
                                                                                id: rows.insertId,
                                                                                ...newModel,
                                                                            });
                                                                        }
                                                                    });
                                                                }
                                                            },
                                                        );
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
            }
        });
    });
    /* End transaction */
};

module.exports = Model;
