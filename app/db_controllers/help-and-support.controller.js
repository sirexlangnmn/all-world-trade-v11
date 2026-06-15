const { v4: uuidV4 } = require('uuid');
const { check, validationResult } = require('express-validator');
const db = require('../db_models');
const sequelizeConfig = require('../config/sequelize.config.js');

const Support_accounts = db.support_accounts;

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

    const email_address = req.body.hasrEmailAddress;
    let condition = email_address ? { email_address: email_address } : null;

    const emailExist = await Support_accounts.findAll({ where: condition })
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
        // let agreeInTermsAndConditions = req.body.agreeInTermsAndConditions;
        let agreeInTermsAndConditions = 1;
        if (agreeInTermsAndConditions) {
            let uuid = uuidV4();

            let usersObjects = {
                first_name: req.body.hasrFirstname,
                last_name: req.body.hasrLastname,
                email_address: req.body.hasrEmailAddress,
                password: req.body.hasrHashedPassword,
                status: 0,
                uuid: uuid,
            };

            Support_accounts.create(usersObjects)
                .then((data) => {
                    // res.send(data);
                    let responseData = {
                        message: 'account has been created',
                    };

                    res.send(responseData);
                })
                .catch((err) => {
                    res.status(500).send({
                        message: err.message || 'Some error occurred while creating the Tutorial.',
                    });
                });
        } else {
            console.log('agreeInTermsAndConditions NO');
            let responseData = {
                message: 'must agree in terms and conditions',
            };

            res.send(responseData);
        }
    }
};
