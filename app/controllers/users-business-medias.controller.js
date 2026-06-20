const Tutorial = require('../models/users-business-medias.model.js');

// Retrieve all users business videos from the database (with condition).
exports.findAllBrochures = (req, res) => {};

exports.companiesProfilePicture = (req, res) => {};
exports.companiesProfilePictureInSelection = (req, res) => {};
// ===================
// Retrieve objects
// ===================
// Retrieve all users business videos from the database (with condition).
exports.findAllBrochures = (req, res) => {
    const uuid = req.session.user.uuid;

    Tutorial.getAll(uuid, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving users business videos.',
            });
        else res.send(data);
    });
};

exports.companiesProfilePicture = (req, res) => {
    let companyID = req.body.id;
    let companyUUID = req.body.uuid;

    Tutorial.companiesProfilePicture(companyID, companyUUID, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving user account.',
            });
        else res.send(data);
    });
};

exports.companiesProfilePictureInSelection = (req, res) => {
    let companyID = req.body.id;
    let companyUUID = req.body.uuid;

    Tutorial.companiesProfilePictureInSelection(companyID, companyUUID, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving user account.',
            });
        else res.send(data);
    });
};
