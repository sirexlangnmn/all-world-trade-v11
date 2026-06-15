const { check, validationResult } = require('express-validator');

const validationMiddleware = [
    check('companyName').not().isEmpty().withMessage('S: Company Name is required.').trim().escape(),
    check('businessWebsite').not().isEmpty().withMessage('S: Business Website is required.').trim().escape(),
    check('businessEmailAddress')
        .not()
        .isEmpty()
        .withMessage('S: Business Email Address is required')
        .trim()
        .escape()
        .isEmail()
        .withMessage('S: Invalid Email Address.'),
    check('businessContactNumber').not().isEmpty().withMessage('S: First Name is required.').trim().escape(),
    check('businessSocialMediaContactNumber')
        .not()
        .isEmpty()
        .withMessage('S: Social Media Contact number is required.')
        .trim()
        .escape(),
    check('businessCountryLocation')
        .not()
        .isEmpty()
        .withMessage('S: Business Country Location is required.')
        .trim()
        .escape(),
    check('businessStatesLocation')
        .not()
        .isEmpty()
        .withMessage('S: Business States Location is required.')
        .trim()
        .escape(),
    check('businessCityLocation').not().isEmpty().withMessage('S: Business City Location is required.').trim().escape(),

    check('firstName').not().isEmpty().withMessage('S: First Name is required.').trim().escape(),
    check('lastName').not().isEmpty().withMessage('S: Last Name is required.').trim().escape(),
    check('middleName').trim().escape(),
    check('country').not().isEmpty().withMessage('S: Country is required.').trim().escape(),
    check('states').not().isEmpty().withMessage('S: States is required.').trim().escape(),
    check('city').not().isEmpty().withMessage('S: City is required.').trim().escape(),
    check('language').not().isEmpty().withMessage('S: Language is required.'),
    check('emailAddress')
        .not()
        .isEmpty()
        .withMessage('S: Email Address is required')
        .trim()
        .escape()
        .isEmail()
        .withMessage('S: Invalid Email Address.'),
    check('personalSocialMediaContactNumber')
        .not()
        .isEmpty()
        .withMessage('S: Personal Contact number is required.')
        .trim()
        .escape(),
    check('password').not().isEmpty().withMessage('S: Password is required.'),
    check('confirmPassword', 'S: Passwords do not match').custom((value, { req }) => value === req.body.password),
];

module.exports = validationMiddleware;
