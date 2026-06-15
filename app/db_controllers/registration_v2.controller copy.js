const { v4: uuidV4 } = require('uuid');
const { check, validationResult } = require('express-validator');
const db = require('../db_models');
const sequelizeConfig = require('../config/sequelize.config.js');

const Users = db.users;
const Users_accounts = db.users_accounts;
// const Users_addresses = db.users_address;
// const Users_business_characteristics = db.users_business_characteristics;
// const Users_business_medias = db.users_business_medias;
// const Users_business_visibilities = db.users_business_visibility;
// const Users_businesses = db.users_businesses;

const Op = db.Sequelize.Op;

// const CryptoJS = require('crypto-js');

// const JWT_SECRET = process.env.JWT_SECRET;
// const AWT_HOSTNAME = process.env.AWT_HOSTNAME;

exports.create = async (req, res) => {
    //    console.log("🚀 ~ file: registration_v2.controller.js:17 ~ exports.create= ~ req.body:", req.body)
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
            message: 'email already in use',
        };

        res.send(responseData);
    } else {
        const { firstName, accountType, contactNumber, emailAddress, password, hashedPassword, terms } = req.body;

        let agreeInTermsAndConditions = terms;
        if (agreeInTermsAndConditions) {
            let session = req.session;
            const uuid = uuidV4();
            //const communicator = uuidV4();

            const sequelize = sequelizeConfig.sequelize;
            const transaction = await sequelize.transaction();

            try {
                let usersObjects = {
                    first_name: firstName,
                    last_name: lastName,
                    uuid: uuid,
                };

                // let usersAccountsObjects = {
                //     email_or_social_media: emailAddress,
                //     contact_number: contactNumber,
                //     password: hashedPassword,
                //     type: accountType, // 1 = trader, 2 = large scale, 3 = medium scale, 4 = small scale
                //     uuid: uuid,
                // };

                // let usersAddressObjects = {
                //     uuid: uuid,
                // };

                // let userBusinessCharacteristicsObjects = {
                //     uuid: uuid,
                // };

                // let userBusinessMediasObjects = {
                //     uuid: uuid,
                // };

                // let userBusinessVisibilitiesObjects = {
                //     uuid: uuid,
                // };

                // let userBusinessObjects = {
                //     business_email: emailAddress,
                //     business_language_of_communication: 'en',
                //     business_contact: contactNumber,
                //     business_social_media_contact_number: contactNumber,
                //     communicator: communicator,
                //     uuid: uuid,
                // };

                console.log('usersObjects', usersObjects);
                // console.log('usersAccountsObjects', usersAccountsObjects);
                // console.log('usersAddressObjects', usersAddressObjects);
                // console.log('userBusinessCharacteristicsObjects', userBusinessCharacteristicsObjects);
                // console.log('userBusinessMediasObjects', userBusinessMediasObjects);
                // console.log('userBusinessVisibilitiesObjects', userBusinessVisibilitiesObjects);
                // console.log('userBusinessObjects', userBusinessObjects);

                //const user = await Users.create(usersObjects, { transaction: transaction });
                // await Users_accounts.create(usersAccountsObjects, { transaction: transaction });
                // await Users_addresses.create(usersAddressObjects, { transaction: transaction });
                // await Users_business_characteristics.create(userBusinessCharacteristicsObjects, { transaction: transaction });
                // await Users_business_medias.create(userBusinessMediasObjects, { transaction: transaction });
                // await Users_business_visibilities.create(userBusinessVisibilitiesObjects, { transaction: transaction });
                // await Users_businesses.create(userBusinessObjects, { transaction: transaction });

                // await transaction.commit();

                // const cipherUuid = 0;
                // // const cipherUuid = CryptoJS.AES.encrypt(uuid, JWT_SECRET).toString();

                // let sessionUser = {
                //     uuid: cipherUuid,
                //     email_or_social_media: emailAddress,
                //     type: accountType,
                //     first_name: firstName,
                //     last_name: '',
                //     country: '',
                //     state_or_province: '',
                // };

                // console.log('sessionUser', sessionUser);

                // session.user = sessionUser;

                // let responseData = {
                //     message: 'account has been created',
                // };

                //res.send(responseData);
            } catch (e) {
                await transaction.rollback();

                let responseData = {
                    message: 'rollback',
                };

                res.send(responseData);
            }
        } else {
            console.log('agreeInTermsAndConditions NO');
            let responseData = {
                message: 'must agree in terms and conditions',
            };

            res.send(responseData);
        }
    }
};
