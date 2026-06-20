const { v4: uuidV4 } = require('uuid');
const { check, validationResult } = require('express-validator');
const CryptoJS = require('crypto-js');
const JWT_SECRET = process.env.JWT_SECRET;
const db = require('../db_models');
const sequelizeConfig = require('../config/sequelize.config.js');
const Users_business = db.users_businesses;
const Users_business_characteristics = db.users_business_characteristics;
const Op = db.Sequelize.Op;

exports.update = async (req, res) => {
    try {
        const {
            companyName,
            tagline,
            website,
            businessEmailAddress,
            businessContactNumber,
            businessSocialMediaContactType,
            businessSocialMediaContactNumber,
            businessAddress,
            editBusinessCountryLocation,
            editBusinessStatesLocation,
            editBusinessCityLocation,
            editLanguagesOfCommunication,
            editTradeCategory,
            subCategorySelect,
            subCategoryManual,
            minorSubCategorySelect,
            minorSubCategoryManual,
            startOperatingHour,
            endOperatingHour,
            editBusinessScale,
            textAreaAddKeywords,
        } = req.body;

        const uuid = CryptoJS.AES.decrypt(req.session.user.uuid, process.env.JWT_SECRET).toString(CryptoJS.enc.Utf8);
        const business_social_media_contact_type = businessSocialMediaContactType || null;

        let uniqueChars = [...new Set(editLanguagesOfCommunication)];
        const languages = uniqueChars.join(',');

        const business_sub_category = subCategorySelect || null;
        const business_sub_category_str =
            subCategoryManual !== undefined && subCategoryManual !== '' ? subCategoryManual : null;
        const business_minor_sub_category = minorSubCategorySelect || null;
        const business_minor_sub_category_str =
            minorSubCategoryManual !== undefined && minorSubCategoryManual !== '' ? minorSubCategoryManual : null;

        const sequelize = sequelizeConfig.sequelize;
        const transaction = await sequelize.transaction();

        try {
            const usersBusinessObjects = {
                business_name: companyName,
                business_email: businessEmailAddress,
                business_contact: businessContactNumber,
                business_language_of_communication: languages,
                business_tagline: tagline,
                business_website: website,
                business_social_media_contact_type: business_social_media_contact_type,
                business_social_media_contact_number: businessSocialMediaContactNumber,
                business_address: businessAddress,
                business_country: editBusinessCountryLocation,
                business_states: editBusinessStatesLocation,
                business_city: editBusinessCityLocation,
                start_operating_hour: startOperatingHour,
                end_operating_hour: endOperatingHour,
            };

            const usersBusinessCharacteristicsObjects = {
                business_industry_belong_to: textAreaAddKeywords,
                business_scale: editBusinessScale,
                business_major_category: editTradeCategory,
                business_sub_category: business_sub_category,
                business_sub_category_str: business_sub_category_str,
                business_minor_sub_category: business_minor_sub_category,
                business_minor_sub_category_str: business_minor_sub_category_str,
            };

            const condition = { uuid };

            await Promise.all([
                Users_business.update(usersBusinessObjects, { where: condition, transaction }),
                Users_business_characteristics.update(usersBusinessCharacteristicsObjects, {
                    where: condition,
                    transaction,
                }),
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
