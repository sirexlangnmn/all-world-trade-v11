const Visibility = require('../models/users-business-visibility.model.js');

// Retrieve all Visibility from the database (with condition).
exports.get = (req, res) => {};

// ===================
// Retrieve objects
// ===================
// Retrieve all Visibility from the database (with condition).
exports.get = (req, res) => {
    const uuid = req.session.user.uuid;

    Visibility.get(uuid, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving business visibility.',
            });
        else res.send(data);
    });
};
