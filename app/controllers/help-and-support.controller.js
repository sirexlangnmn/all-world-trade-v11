const { validationResult } = require('express-validator');
const Controller = require('../models/help-and-support.model.js');

// Create and Save a new Controller
exports.create = (req, res) => {};

// ===================
// Create a new object
// ===================
exports.create = (req, res) => {
    // Validate request
    if (!req.body) {
        res.status(400).send({
            message: 'Content can not be empty!',
        });
    }

    // Create a Controller
    const inputData = new Controller({
        session: req.session,

        // support_accounts
        first_name: req.body.hasrFirstname,
        last_name: req.body.hasrLastname,
        email_address: req.body.hasrEmailAddress,
        password: req.body.hasrPassword,
    });

    // Save Controller in the database
    Controller.create(inputData, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while creating the Model.',
            });
        else res.send(data);
    });
};
