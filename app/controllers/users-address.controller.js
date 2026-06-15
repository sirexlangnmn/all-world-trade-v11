const Tutorial = require('../models/users-address.model.js');

// Retrieve user from the database (with condition).
exports.find = (req, res) => {};

// ===================
// Retrieve objects
// ===================
// Retrieve user address from the database (with condition).
exports.find = (req, res) => {
    const uuid = req.session.user.uuid;

    Tutorial.getAll(uuid, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving user address.',
            });
        else res.send(data);
    });
};
