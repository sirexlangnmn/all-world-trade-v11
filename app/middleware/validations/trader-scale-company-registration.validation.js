const { check, validationResult } = require('express-validator');

const validationMiddleware = [
    check('traderCompanyName').not().isEmpty().withMessage('S: Trader Company Name is required.').trim().escape(),
    check('traderCompanyTagline').trim().escape(),
    check('traderWebsite').not().isEmpty().withMessage('S: Business Website is required').trim().escape(),
    check('traderBusinessEmailAddress')
        .not()
        .isEmpty()
        .withMessage('S: Business Email Address is required.')
        .trim()
        .escape()
        .isEmail()
        .withMessage('S: Invalid Email Address.'),
    check('traderBusinessContactNumber')
        .not()
        .isEmpty()
        .withMessage('S: Business Contact Number is required.')
        .trim()
        .escape(),
    check('traderBusinessSocialMediaContactNumber')
        .not()
        .isEmpty()
        .withMessage('S: Social Media / Messaging App Contact Number is required.')
        .trim()
        .escape(),
    check('traderBusinessAddress').not().isEmpty().withMessage('S: Business Address is required.').trim().escape(),
    check('traderBusinessCountryLocation')
        .not()
        .isEmpty()
        .withMessage('S: Business Country Location is required.')
        .trim()
        .escape(),
    check('traderBusinessCityLocation')
        .not()
        .isEmpty()
        .withMessage('S: Business States Location is required.')
        .trim()
        .escape(),
    check('traderBusinessCityLocations')
        .not()
        .isEmpty()
        .withMessage('S: Business City Location is required.')
        .trim()
        .escape(),
    check('traderLanguagesOfCommunication').not().isEmpty().withMessage('S: Language is required.'),
    check('traderTradeCategory').not().isEmpty().withMessage('S: Trade Category is required.').trim().escape(),
    check('traderSubCategoryToggleField').not().isEmpty().withMessage('S: Sub Category is required.').trim().escape(),
    check('traderMinorSubCategoryToggleField').trim().escape(),

    check('traderGivenNameOfRepresentative').not().isEmpty().withMessage('S: First Name is required.').trim().escape(),
    check('traderSurnameOfRepresentative').not().isEmpty().withMessage('S: Last Name is required.').trim().escape(),
    check('traderMiddleNameOfRepresentative').trim().escape(),
    check('traderCountryofResidence').not().isEmpty().withMessage('S: Country is required.').trim().escape(),
    check('traderCityOfResidence').not().isEmpty().withMessage('S: States is required.').trim().escape(),
    check('traderCityOfResidences').not().isEmpty().withMessage('S: City is required.').trim().escape(),
    check('traderCellphone').trim().escape(),
    check('traderEmailAddress')
        .not()
        .isEmpty()
        .withMessage('S: Email Address is required')
        .trim()
        .escape()
        .isEmail()
        .withMessage('S: Invalid Email Address.'),
    check('traderPassword').not().isEmpty().withMessage('S: Password is required.'),
    check('traderConfirmPassword', 'S: Passwords do not match').custom(
        (value, { req }) => value === req.body.traderPassword,
    ),
];

module.exports = validationMiddleware;
