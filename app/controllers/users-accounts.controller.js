const Tutorial = require('../models/users-accounts.model.js');

// Retrieve user account from the database (with condition).
exports.find = (req, res) => {};

exports.emailVerification = (req, res) => {};

// ===================
// Retrieve objects
// ===================
// Retrieve user account from the database (with condition).
exports.find = (req, res) => {
    const uuid = req.session.user.uuid;

    Tutorial.getAll(uuid, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving user account.',
            });
        else res.send(data);
    });
};

exports.emailVerification = (req, res) => {
    const registration_uuid = req.session.registration_uuid;
    const verification_code = req.session.verification_code;
    const inputCode = req.body.inputCode;

    Tutorial.emailVerification(registration_uuid, verification_code, inputCode, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving user account.',
            });
        else res.send(data);
    });
};
