const Tutorial = require('../models/users-business-characteristics.model.js');

// Retrieve all Tutorials from the database (with condition).
exports.findAll = (req, res) => {};

// ===================
// Retrieve objects
// ===================
// Retrieve all Tutorials from the database (with condition).
exports.findAll = (req, res) => {
    const uuid = req.session.user.uuid;

    Tutorial.getAll(uuid, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving business characteristics.',
            });
        else res.send(data);
    });
};
