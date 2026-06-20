const { v4: uuidV4 } = require('uuid');
const { check, validationResult } = require('express-validator');
const CryptoJS = require('crypto-js');
const JWT_SECRET = process.env.JWT_SECRET;
const db = require('../db_models');
const sequelizeConfig = require('../config/sequelize.config.js');
const Users_business = db.users_businesses;
const Users_business_visibilities = db.users_business_visibility;
const Op = db.Sequelize.Op;

exports.update = async (req, res) => {
    try {
        const {
            iOperateOnAWorldWideLevelRadioButton,
            iOperateOnAGlobalRegionalLevelRadioButton,
            iOperateOnANationalLevelRadioButton,
            iOperateOnAStateLevelRadioButton,
            iOperateOnACityLevelRadioButton,
            traderRegionOfOperation,
            traderCountryOfOperation,
            countryForStateOperation,
            traderStatesOfOperation,
            countryForCityOperation,
            statesForCityOperation,
            traderCityOfOperation,
        } = req.body;

        const uuid = CryptoJS.AES.decrypt(req.session.user.uuid, process.env.JWT_SECRET).toString(CryptoJS.enc.Utf8);

        const i_operate_on_a_world_wide_level = iOperateOnAWorldWideLevelRadioButton === undefined ? 0 : 1;
        const i_operate_on_a_global_regional_level = iOperateOnAGlobalRegionalLevelRadioButton === undefined ? 0 : 1;
        const i_operate_on_a_national_level = iOperateOnANationalLevelRadioButton === undefined ? 0 : 1;
        const i_operate_on_a_state_level = iOperateOnAStateLevelRadioButton === undefined ? 0 : 1;
        const i_operate_on_a_city_level = iOperateOnACityLevelRadioButton === undefined ? 0 : 1;

        let region_of_operation = null;
        let country_of_operation = null;
        let country_for_state = null;
        let states_of_operation = null;
        let country_for_city = null;
        let states_for_city = null;
        let city_of_operation = null;

        if (i_operate_on_a_world_wide_level === 1) {
            region_of_operation = null;
            country_of_operation = null;
            country_for_state = null;
            states_of_operation = null;
            country_for_city = null;
            states_for_city = null;
            city_of_operation = null;
        }

        if (i_operate_on_a_global_regional_level === 1) {
            if (typeof traderRegionOfOperation === 'string') {
                region_of_operation = traderRegionOfOperation;
            }
            if (typeof traderRegionOfOperation === 'object') {
                const uniqueRegions = [...new Set(traderRegionOfOperation)];
                region_of_operation = uniqueRegions.join(',');
            }
            if (typeof traderRegionOfOperation === 'undefined') {
                region_of_operation = null;
            }
        }

        if (i_operate_on_a_national_level === 1) {
            if (typeof traderCountryOfOperation === 'string') {
                country_of_operation = traderCountryOfOperation;
            }
            if (typeof traderCountryOfOperation === 'object') {
                const uniqueCountries = [...new Set(traderCountryOfOperation)];
                country_of_operation = uniqueCountries.join(',');
            }
            if (typeof traderCountryOfOperation === 'undefined') {
                country_of_operation = null;
            }
        }

        if (i_operate_on_a_state_level === 1) {
            country_for_state = countryForStateOperation;
            states_of_operation = traderStatesOfOperation;
        }

        if (i_operate_on_a_city_level === 1) {
            country_for_city = countryForCityOperation;
            states_for_city = statesForCityOperation;
            city_of_operation = traderCityOfOperation;
        }

        const sequelize = sequelizeConfig.sequelize;
        const transaction = await sequelize.transaction();

        try {
            const usersBusinessObjects = {
                region_of_operation: region_of_operation,
                country_of_operation: country_of_operation,
                country_for_state: country_for_state,
                states_of_operation: states_of_operation,
                country_for_city: country_for_city,
                states_for_city: states_for_city,
                city_of_operation: city_of_operation,
            };

            const usersBusinessVisibilitiesObjects = {
                i_operate_on_a_world_wide_level: i_operate_on_a_world_wide_level,
                i_operate_on_a_global_regional_level: i_operate_on_a_global_regional_level,
                i_operate_on_a_national_level: i_operate_on_a_national_level,
                i_operate_on_a_state_level: i_operate_on_a_state_level,
                i_operate_on_a_city_level: i_operate_on_a_city_level,
            };

            console.log('usersBusinessObjects: ', usersBusinessObjects);
            console.log('usersBusinessVisibilitiesObjects: ', usersBusinessVisibilitiesObjects);

            const condition = { uuid };

            await Promise.all([
                Users_business.update(usersBusinessObjects, { where: condition, transaction }),
                Users_business_visibilities.update(usersBusinessVisibilitiesObjects, { where: condition, transaction }),
            ]);

            await transaction.commit();

            res.send('success');
        } catch (e) {
            await transaction.rollback();

            let responseData = {
                message: 'rollback',
            };

            res.send(responseData);
        }
    } catch (error) {
        // handle error
    }
};
