module.exports = (app) => {
    const { check, validationResult } = require('express-validator');

    const controllers = require('../db_controllers');
    const middleware = require('../middleware');

    const smallScaleCompanyRegistrationValidation = middleware.smallScaleCompanyRegistrationValidation;
    const smallScaleCompanyRegistrationController = controllers.small_scale_company_registration;

    const mediumScaleCompanyRegistrationValidation = middleware.mediumScaleCompanyRegistrationValidation;
    const mediumScaleCompanyRegistrationController = controllers.medium_scale_company_registration;

    const largeScaleCompanyRegistrationValidation = middleware.largeScaleCompanyRegistrationValidation;
    const largeScaleCompanyRegistrationController = controllers.large_scale_company_registration;

    const traderScaleCompanyRegistrationValidation = middleware.traderScaleCompanyRegistrationValidation;
    const traderScaleCompanyRegistrationController = controllers.trader_scale_company_registration;

    const registrationV2Controller = controllers.registration_v2;
    const registrationV2Validation = middleware.registration_v2;

    const helpAndSupportRegistrationController = controllers.help_and_support_registration;
    const supportLinksController = controllers.support_links;
    const supportMessagesController = controllers.support_messages;
    const communicatorController = controllers.communicator;
    const usersBusinessesController = controllers.users_businesses;
    const usersAccountsController = controllers.users_accounts;

    const updateTrader = controllers.update_trader;
    const regionOfOperation = controllers.region_of_operation;

    const joinController = controllers.join;
    const waitingRoomsController = controllers.waiting_rooms;

    const updateTraders = controllers.update_traders; // delete in future
    const updateLarge = controllers.update_large_scale_company; // delete in future
    const updateMedium = controllers.update_medium_scale_company; // delete in future

    app.post(
        ['/api/v2/post/small-scale-company-registration'],
        smallScaleCompanyRegistrationValidation,
        smallScaleCompanyRegistrationController.create,
    );

    app.post(
        ['/api/v2/post/medium-scale-company-registration'],
        mediumScaleCompanyRegistrationValidation,
        mediumScaleCompanyRegistrationController.create,
    );

    app.post(
        ['/api/v2/post/large-scale-company-registration'],
        largeScaleCompanyRegistrationValidation,
        largeScaleCompanyRegistrationController.create,
    );

    app.post(
        ['/api/v2/post/trader-scale-company-registration'],
        traderScaleCompanyRegistrationValidation,
        traderScaleCompanyRegistrationController.create,
    );

    app.post(['/api/v2/post/registration-v2'], registrationV2Validation, registrationV2Controller.create);

    app.post(['/api/v2/post/help-and-support-registration-process'], helpAndSupportRegistrationController.create);

    app.post(['/api/v2/get/create-help-and-support-communicator-link'], supportLinksController.create);

    app.post(['/api/v2/get/drop-help-and-support-communicator-link'], supportLinksController.drop);

    app.post(['/api/v2/post/go-to-help-and-suggestion-page'], supportLinksController.getSupportLinks);

    app.post(['/api/v2/post/update-as-occupied'], supportLinksController.updateAsOccupied);

    app.get('/api/get/communicator-link/:link', communicatorController.findCommunicator);

    app.post('/api/post/communicator-participants/:peers_count/:strippedRoomId', communicatorController.peersCount);

    app.post('/api/v2/post/submit-email-if-help-and-suggest-link-not-available', supportMessagesController.create);

    app.get(['/api/v2/get/number-of-trader-members'], usersBusinessesController.numberOfTraderMembers);

    app.get(['/api/v2/get/number-of-visitor-members'], usersAccountsController.numberOfVisitorMembers);

    // api for data aggregation and data checking
    app.get(['/api/v2/get/traders-data'], usersAccountsController.tradersData);

    app.post(['/api/v2/update/update-company-details'], updateTrader.update);
    app.post(['/api/v2/update/region-of-operation'], regionOfOperation.update);

    app.get(['/api/v2/get/latest-users'], joinController.getLatestRegisteredUsers);

    app.post(['/api/v2/post/check-if-trader-is-active'], usersAccountsController.checkIfTraderIsActive);

    app.post(['/api/v2/post/generate-waiting-room'], waitingRoomsController.generateWaitingRoom);


    app.post(['/api/v2/post/update-company-details'], updateTraders.update); // delete in future
    app.post(['/api/v2/post/update-large-scale-company'], updateLarge.update); // delete in future
    app.post(['/api/v2/post/update-medium-scale-company'], updateMedium.update); // delete in future

};
