const Controller = require('../models/forgot-password.model.js');

// Create and Save a new Controller
exports.create = (req, res) => {};

// ===================
// Create a new object
// ===================
exports.create = (req, res) => {
    if (!req.body) {
        res.status(400).send({
            message: 'Content can not be empty!',
        });
        return;
    }

    // Create a Controller
    const inputData = new Controller({
        email_or_social_media: req.body.emailAddress,
    });

    // Save Controller in the database
    Controller.create(inputData, (err, data) => {
        if (err) {
            res.status(500).send({
                message: err.message || 'Some error occurred while creating the Model.',
            });
            return;
        } else {
            res.send(data);
        }
    });
};
