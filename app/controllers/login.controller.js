const Controller = require('../models/login.model.js');
const { check, validationResult } = require('express-validator');

// Create and Save a new Controller
exports.create = (req, res) => {};

// ===================
// Create a new object
// ===================
exports.create = (req, res) => {
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

    if (!req.body) {
        res.status(400).send({
            message: 'Content can not be empty!',
        });
    }

    if (req.body.loginEmailAddress && req.body.loginPassword) {
        console.log('req.body.loginEmailAddress', req.body.loginEmailAddress);

        // Create a Controller
        const inputData = new Controller({
            email_or_social_media: req.body.loginEmailAddress,
            password: req.body.loginPassword,
            session: req.session,
        });

        // Save Controller in the database
        Controller.create(inputData, (err, data) => {
            if (err)
                res.status(500).send({
                    message: err.message || 'Some error occurred while creating the Model.',
                });
            else res.send(data);
        });
    } else {
        let errorData = {
            message: 'Please enter Username and Password!',
        };
        res.send(errorData);
        res.end();
    }
};
