const { v4: uuidV4 } = require('uuid');
const { check, validationResult } = require('express-validator');
const CryptoJS = require('crypto-js');
const JWT_SECRET = process.env.JWT_SECRET;
const db = require('../db_models');
const sequelizeConfig = require('../config/sequelize.config.js');
const Users = db.users;
const Users_accounts = db.users_accounts;
const Users_address = db.users_address;
const Users_business = db.users_businesses;
const Users_business_characteristics = db.users_business_characteristics;
const Op = db.Sequelize.Op;

exports.update = async (req, res) => {
    try {
        const {
            companyName,
            businessWebsite,
            businessEmailAddress,
            businessContactNumber,
            businessSocialMediaContactType,
            businessSocialMediaContactNumber,
            businessCountryLocation,
            businessStatesLocation,
            businessCityLocation,
            language,
            firstName,
            lastName,
            middleName,
            country,
            states,
            city,
            personalSocialMediaContactType,
            personalSocialMediaContactNumber,
        } = req.body;

        const uuid = CryptoJS.AES.decrypt(req.session.user.uuid, process.env.JWT_SECRET).toString(CryptoJS.enc.Utf8);
        const business_social_media_contact_type = businessSocialMediaContactType || null;
        const personal_social_media_contact_type = personalSocialMediaContactType || null;
        let uniqueChars = [...new Set(language)];
        const editLanguagesOfCommunication = uniqueChars.join(',');

        const sequelize = sequelizeConfig.sequelize;
        const transaction = await sequelize.transaction();

        try {
            const usersObjects = {
                first_name: firstName,
                last_name: lastName,
                middle_name: middleName,
            };

            const usersAddressObjects = {
                country: country,
                state_or_province: states,
                city: city,
            };

            const usersAccountsObjects = {
                social_media_contact_type: personal_social_media_contact_type,
                contact_number: personalSocialMediaContactNumber,
            };

            const usersBusinessObjects = {
                business_name: companyName,
                business_email: businessEmailAddress,
                business_contact: businessContactNumber,
                business_language_of_communication: editLanguagesOfCommunication,
                business_website: businessWebsite,
                business_social_media_contact_type: business_social_media_contact_type,
                business_social_media_contact_number: businessSocialMediaContactNumber,
                business_country: businessCountryLocation,
                business_states: businessStatesLocation,
                business_city: businessCityLocation,
            };

            const condition = { uuid };

            await Promise.all([
                Users_business.update(usersBusinessObjects, { where: condition, transaction }),
                Users.update(usersObjects, { where: condition, transaction }),
                Users_accounts.update(usersAccountsObjects, { where: condition, transaction }),
                Users_address.update(usersAddressObjects, { where: condition, transaction }),
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
