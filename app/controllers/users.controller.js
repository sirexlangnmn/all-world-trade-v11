const Tutorial = require('../models/users.model.js');

// Retrieve user from the database (with condition).
exports.find = (req, res) => {};

// ===================
// Retrieve objects
// ===================
// Retrieve user from the database (with condition).
exports.find = (req, res) => {
    // res.header("Access-Control-Allow-Origin", "");
    // res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    const uuid = req.session.user.uuid;

    Tutorial.getAll(uuid, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving user.',
            });
        else res.send(data);
    });
};
