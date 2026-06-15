module.exports = (app) => {
    // no longer used
    //const traderRegistrationValidation = require('../middleware/trader-registration-validation.js');

    // no longer used
    // const session = require('express-session');
    // app.use(
    //     session({
    //         secret: process.env.SESSION_SECRET,
    //         resave: false,
    //         saveUninitialized: true,
    //         cookie: { maxAge: 365 * 24 * 60 * 60 * 1000 },
    //     }),
    // );

    const middleware = require('../middleware');

    const usersBusiness = require('../controllers/users-business.controller.js');
    const users = require('../controllers/users.controller.js');
    const usersAccounts = require('../controllers/users-accounts.controller.js');
    const usersAddress = require('../controllers/users-address.controller.js');
    const usersBusinessCharacteristics = require('../controllers/users-business-characteristics.controller.js');
    const usersBusinessVisibility = require('../controllers/users-business-visibility.controller.js');
    const usersBusinessVideos = require('../controllers/users-business-videos.controller.js');
    const usersBusinessMedias = require('../controllers/users-business-medias.controller.js');
    const selection = require('../controllers/selection.controller.js');
    const usersBusinessImages = require('../controllers/users-business-images.controller.js');
    const categories = require('../controllers/categories.controller.js');
    const subCategories = require('../controllers/sub-categories.controller.js');
    const minorSubCategories = require('../controllers/minor-sub-categories.controller.js');
    const globalRegion = require('../controllers/global-region.controller.js');
    const languages = require('../controllers/languages.controller.js');
    const tradeCategories = require('../controllers/trade-categories.controller.js');
    const traderRegistration = require('../controllers/traderRegistration.controller.js');
    const smallScaleCompanyRegistration = require('../controllers/smallScaleCompanyRegistration.controller.js');
    const smallScaleCompany = require('../controllers/small-scale-company.controller.js');
    const mediumScaleCompanyRegistration = require('../controllers/mediumScaleCompanyRegistration.controller.js');
    const mediumScaleCompany = require('../controllers/medium-scale-company.controller.js');
    const largeScaleCompany = require('../controllers/large-scale-company.controller.js');
    const largeScaleCompanyRegistration = require('../controllers/largeScaleCompanyRegistration.controller.js');
    const companyDetails = require('../controllers/companyDetails.controller.js');
    const upgradeToMediumScaleCompany = require('../controllers/upgrade-to-medium-scale-company.controller.js');
    const upgradeToLargeScaleCompany = require('../controllers/upgrade-to-large-scale-company.controller.js');
    const upgradeToTraders = require('../controllers/upgrade-to-traders.controller.js');
    const login = require('../controllers/login.controller.js');
    const forgotPassword = require('../controllers/forgot-password.controller.js');
    const visitorsOfTraders = require('../controllers/visitors-of-traders.controller.js');
    const helpAndSupport = require('../controllers/help-and-support.controller.js');
    const helpAndSupportLogin = require('../controllers/help-and-support-login.controller.js');
    const getCount = require('../controllers/get-count.controller.js');

    // Retrieve all Categories
    app.get(['/api/get/categories'], categories.findAll);

    // Retrieve sub categories using trade category id
    app.get('/api/get/sub-categories-by-trade-category-id/:id', subCategories.getSubCategoriesByTradeCategoryId);

    // Retrieve all global region
    app.get(['/api/get/region-of-operations'], globalRegion.findAll);

    // Retrieve all languages
    app.get(['/api/get/languages'], languages.findAll);

    // Retrieve languages name using language code
    app.get('/api/get/language-name-by-code/:id', languages.getLanguageNameByCode);

    // Retrieve trade category title using id
    app.get('/api/get/trade-category-title-by-id/:id', tradeCategories.getTradeCategoryTitleById);

    // Retrieve for todays Trade Categories
    app.get(['/api/get/trade-categories-for-today'], tradeCategories.getTradeCategoriesForToday);

    // Retrieve sub category title using id
    app.get('/api/get/sub-category-title-by-id/:id', subCategories.getSubCategoryTitleById);

    // Retrieve minor sub category title using id
    app.get('/api/get/minor-sub-category-title-by-id/:id', minorSubCategories.getMinorSubCategoryTitleById);

    // Retrieve region of operation by iso
    app.get('/api/get/region-of-opertaion-by-iso/:id', globalRegion.getRegionOfOpertaionByIso);

    // Retrieve minor sub categories using sub category id
    app.get(
        '/api/get/minor-sub-categories-by-sub-category-id/:id',
        minorSubCategories.getMinorSubCategoriesBySubCategoryId,
    );

    // Retrieve minor sub categories using id
    app.get('/api/get/minor-sub-categories-by-id/:id', minorSubCategories.getMinorSubCategoriesById);

    app.get('/api/get/minor-sub-category-by-title/:title', minorSubCategories.getMinorSubCategoryByTitle);

    app.post(['/api/post/login-process'], middleware.login_process, login.create);

    app.post(['/api/post/help-and-support-login-process'], helpAndSupportLogin.create);

    app.post(['/api/post/forgot-password-process'], forgotPassword.create);

    // Retrieve all Company Details
    app.post(['/api/get/company-details'], usersBusiness.findAll);

    app.post(['/api/get/users-business'], usersBusiness.findUsersBusiness);

    app.post(['/api/get/business-location-code'], usersBusiness.findBusinessLocationCode);

    // Retrieve user
    app.post(['/api/get/user'], users.find);

    // Retrieve user account
    app.post(['/api/get/users-account'], usersAccounts.find);

    // Retrieve user account
    app.post(['/api/post/email-verification'], usersAccounts.emailVerification);

    // Retrieve user account
    app.post(['/api/get/users-address'], usersAddress.find);

    app.post(['/api/get/user-business-characteristics'], usersBusinessCharacteristics.findAll);

    app.post(['/api/get/users-business-visibility'], usersBusinessVisibility.get);

    // Retrieve all users business videos
    app.get(['/api/get/users-business-videos'], usersBusinessVideos.findAll);

    // Retrieve users logo and banner
    app.get(['/api/get/users-logo-and-banners'], usersBusinessImages.findAll);

    // Retrieve all users business brochures
    app.get(['/api/get/users-business-brochures'], usersBusinessMedias.findAllBrochures);

    // Retrieve all companies
    app.post(['/api/get/companies'], usersBusiness.findAllPublished);

    app.post(['/api/get/companies-profile-picture'], usersBusinessMedias.companiesProfilePictureInSelection);

    app.post(['/api/get/get-companies-related-to-current-user'], selection.findCompaniesRelatedToCurrentUser);

    app.post(['/api/get/get-random-companies'], selection.findRandomCompanies);

    app.post(['/api/post/selection-search-parameter'], selection.findAllBySearchParameter);

    // no longer used
    //app.post(['/api/post/trader-registration'], traderRegistrationValidation, traderRegistration.create);

    app.post(['/api/post/looking-for-small-scale-company-registration'], smallScaleCompanyRegistration.create);

    app.post(['/api/post/looking-for-medium-scale-company-registration'], mediumScaleCompanyRegistration.create);

    app.post(['/api/post/looking-for-large-scale-company-registration'], largeScaleCompanyRegistration.create);

    app.post(['/api/post/update-company-details'], companyDetails.update);

    app.post(['/api/post/update-small-scale-company'], smallScaleCompany.update);

    app.post(['/api/post/update-medium-scale-company'], mediumScaleCompany.update);

    // app.post(['/api/post/update-large-scale-company'], largeScaleCompany.update);

    app.post(['/api/post/upgrade-plan-to-medium-scale-company'], upgradeToMediumScaleCompany.update);

    app.post(['/api/post/upgrade-plan-to-large-scale-company'], upgradeToLargeScaleCompany.update);

    app.post(['/api/post/upgrade-to-traders'], upgradeToTraders.update);

    app.post(['/api/post/get-current-visitor'], visitorsOfTraders.findCurrentVisitor);

    app.post(['/api/post/get-current-trader'], visitorsOfTraders.findCurrentTrader);

    app.post(['/api/post/record-the-meeting-of-visitor-and-trader'], visitorsOfTraders.connectVisitorAndTrader);

    // app.get('/api/v2/get/communicator-link/:link', usersBusiness.findCommunicator);

    app.post(['/api/get/create-communicator-link'], usersBusiness.createCommunicatorLink);

    app.get(['/api/v2/get/traders-with-picture'], getCount.tradersWithPicture);
    app.get(['/api/v2/get/traders-with-no-picture'], getCount.tradersWithNoPicture);
    app.get(['/api/v2/get/traders-with-no-picture-no-company'], getCount.tradersWithNoPictureAndCompany);
};
