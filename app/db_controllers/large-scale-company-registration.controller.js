const { v4: uuidV4 } = require('uuid');
const { check, validationResult } = require('express-validator');
const db = require('../db_models');
const sequelizeConfig = require('../config/sequelize.config.js');
const Users_accounts = db.users_accounts;
const Users_address = db.users_address;
// const Users_business = db.users_business;
const Users_business = db.users_businesses;
const Users_business_characteristics = db.users_business_characteristics;
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

    const email_or_social_media = req.body.emailAddress;
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
            let session = req.session;
            let uuid = uuidV4();
            let verificationCode = Math.floor(Math.random() * 900000) + 100000;
            let language = req.body.traderLanguagesOfCommunication;

            const sequelize = sequelizeConfig.sequelize;
            const transaction = await sequelize.transaction();

            try {
                let usersObjects = {
                    first_name: req.body.traderGivenNameOfRepresentative,
                    last_name: req.body.traderSurnameOfRepresentative,
                    middle_name: req.body.traderMiddleNameOfRepresentative,
                    uuid: uuid,
                };

                let usersAccountsObjects = {
                    email_or_social_media: req.body.emailAddress,
                    social_media_contact_type: req.body.personalSocialMediaContactNumber,
                    contact_number: req.body.traderCellphone,
                    password: req.body.traderHashedPassword,
                    type: 2, // large scale company member/user
                    verification_code: verificationCode,
                    uuid: uuid,
                };

                let usersAddressObjects = {
                    country: req.body.traderCountryofResidence,
                    state_or_province: req.body.traderCityOfResidence,
                    city: req.body.traderCityOfResidences,
                    uuid: uuid,
                };

                let userBusinessObjects = {
                    business_name: req.body.traderCompanyName,
                    business_tagline: req.body.traderCompanyTagline,
                    business_email: req.body.traderBusinessEmailAddress,
                    business_contact: req.body.traderBusinessContactNumber,
                    business_language_of_communication: language.toString(),
                    business_website: req.body.traderWebsite,
                    business_social_media_contact_type: req.body.traderBusinessSocialMediaContactType,
                    business_social_media_contact_number: req.body.traderBusinessSocialMediaContactNumber,
                    business_address: req.body.traderBusinessAddress,
                    business_country: req.body.traderBusinessCountryLocation,
                    business_states: req.body.traderBusinessCityLocation,
                    business_city: req.body.traderBusinessCityLocations,
                    uuid: uuid,
                };

                let usersBusinessCharacteristicsObjects = {
                    business_major_category: req.body.traderTradeCategory,
                    business_sub_category: req.body.traderSubCategoryToggleField,
                    business_minor_sub_category: req.body.traderMinorSubCategoryToggleField,
                    uuid: uuid,
                };

                const user = await Users.create(usersObjects, { transaction: transaction });
                await Users_accounts.create(usersAccountsObjects, { transaction: transaction });
                await Users_address.create(usersAddressObjects, { transaction: transaction });
                await Users_business.create(userBusinessObjects, { transaction: transaction });
                await Users_business_characteristics.create(usersBusinessCharacteristicsObjects, {
                    transaction: transaction,
                });

                await transaction.commit();

                session.verification_code = verificationCode;
                session.registration_uuid = uuid;
                session.registration_email_address = req.body.emailAddress;

                let responseData = {
                    message: 'account has been created',
                    uuid: uuid,
                    verification_code: verificationCode,
                    email_or_social_media: req.body.emailAddress,
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
