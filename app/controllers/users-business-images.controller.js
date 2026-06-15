const Tutorial = require('../models/users-business-images.model.js');

// Retrieve all users business videos from the database (with condition).
exports.findAll = (req, res) => {};

// ===================
// Retrieve objects
// ===================
// Retrieve all users business videos from the database (with condition).
exports.findAll = (req, res) => {
    const uuid = req.session.user.uuid;
    console.log('exports.findAll uuid', uuid);
    console.log('exports.findAll req', req.session);

    Tutorial.getAll(uuid, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving users business videos.',
            });
        else res.send(data);
    });
};
