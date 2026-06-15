const { check, validationResult } = require('express-validator');

const validationMiddleware = [
    // check('companyBanner', 'S:Upload banner.').exists(),
    // check('companyLogo', 'S:Upload logo.').exists(),
    // check('videoInput', 'S:Upload video presenting your company.').exists(),
    // check('thumbnailInput', 'S:Upload video thumbnail.').exists(),
    // check('brochureInput', 'S:Upload brochure related to your company.').exists(),
    // check('webinarsThumbnailInput', 'S:Upload thumbnail image related to your webinars.').exists(),

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
    check('socialMediaContactNumber').not().isEmpty().withMessage('S: Contact number is required.').trim().escape(),
    check('password').not().isEmpty().withMessage('S: Password is required.'),
    check('confirmPassword', 'S: Passwords do not match').custom((value, { req }) => value === req.body.password),
];

module.exports = validationMiddleware;
