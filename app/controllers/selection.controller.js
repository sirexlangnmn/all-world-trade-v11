const Model = require('../models/selection.model.js');

exports.findCompaniesRelatedToCurrentUser = (req, res) => {};

exports.findAllBySearchParameter = (req, res) => {};

exports.findRandomCompanies = (req, res) => {};

exports.findCompaniesRelatedToCurrentUser = (req, res) => {
    const parameters = {
        uuid: req.session.user.uuid,
        country: req.session.user.country,
        state_or_province: req.session.user.state_or_province,
    };

    Model.getCompaniesRelatedToCurrentUser(parameters, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving companies.',
            });
        else res.send(data);
    });
};

exports.findAllBySearchParameter = (req, res) => {
    const uuid = req.session.user.uuid;

    const parameters = {
        uuid: uuid,
        regionOfOperationCode: req.body.regionOfOperationCode,
        countryCode: req.body.countryCode,
        selectionState: req.body.selectionState,
        selectionCity: req.body.selectionCity,
        language: req.body.language,
        business_scale: req.body.business_scale,
        trade_categories: req.body.trade_categories,
        sub_categories: req.body.sub_categories,
        minor_sub_categories: req.body.minor_sub_categories,
        product_service_input: req.body.product_service_input,
        company_name_input: req.body.company_name_input,
    };

    Model.getAllBySearchParameter(parameters, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving companies.',
            });
        else res.send(data);
    });
};

exports.findRandomCompanies = (req, res) => {
    Model.getRandomCompanies((err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving companies.',
            });
        else res.send(data);
    });
};
