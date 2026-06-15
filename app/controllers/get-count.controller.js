const Model = require('../models/get-count.model.js');

exports.tradersWithPicture = (req, res) => {
    // code here
};

exports.tradersWithNoPicture = (req, res) => {
    // code here
};

exports.tradersWithNoPictureAndCompany = (req, res) => {
    // code here
};

exports.tradersWithPicture = (req, res) => {
    Model.tradersWithPicture((err, data) => {
        let dataTradersWithPicture = data;
        let numbersTradersWithPicture = data.length;
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving categories.',
            });
        else
            res.status(200).send({
                numbersTradersWithPicture: numbersTradersWithPicture,
                dataTradersWithPicture: dataTradersWithPicture,
            });
    });
};

exports.tradersWithNoPicture = (req, res) => {
    Model.tradersWithNoPicture((err, data) => {
        let dataTradersWithNoPicture = data;
        let numbersTradersWithNoPicture = data.length;
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving categories.',
            });
        // else res.status(200).send({ numbersTradersWithNoPicture: numbersTradersWithNoPicture });
        else
            res.status(200).send({
                numbersTradersWithNoPicture: numbersTradersWithNoPicture,
                dataTradersWithNoPicture: dataTradersWithNoPicture,
            });
    });
};

exports.tradersWithNoPictureAndCompany = (req, res) => {
    Model.tradersWithNoPictureAndCompany((err, data) => {
        let dataTradersWithNoPictureAndCompany = data;
        let numbersTradersWithNoPictureAndCompany = data.length;
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving categories.',
            });
        // else res.status(200).send({ numbersTradersWithNoPicture: numbersTradersWithNoPicture });
        else
            res.status(200).send({
                numbersTradersWithNoPictureAndCompany: numbersTradersWithNoPictureAndCompany,
                dataTradersWithNoPictureAndCompany: dataTradersWithNoPictureAndCompany,
            });
    });
};
