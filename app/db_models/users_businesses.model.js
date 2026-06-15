module.exports = (sequelize, Sequelize) => {
    const Users_business = sequelize.define('users_business', {
        business_name: {
            type: Sequelize.STRING,
        },
        business_email: {
            type: Sequelize.STRING,
        },
        business_contact: {
            type: Sequelize.STRING,
        },
        business_language_of_communication: {
            type: Sequelize.TEXT('long'),
        },
        business_tagline: {
            type: Sequelize.STRING,
        },
        business_website: {
            type: Sequelize.STRING,
        },
        business_social_media_contact_type: {
            type: Sequelize.TINYINT,
        },
        business_social_media_contact_number: {
            type: Sequelize.STRING,
        },
        business_address: {
            type: Sequelize.STRING,
        },
        business_country: {
            type: Sequelize.STRING,
        },
        business_states: {
            type: Sequelize.STRING,
        },
        business_city: {
            type: Sequelize.STRING,
        },
        region_of_operation: {
            type: Sequelize.STRING,
        },
        country_of_operation: {
            type: Sequelize.STRING,
        },
        country_for_state: {
            type: Sequelize.STRING,
        },
        states_of_operation: {
            type: Sequelize.STRING,
        },
        country_for_city: {
            type: Sequelize.STRING,
        },
        states_for_city: {
            type: Sequelize.STRING,
        },
        city_of_operation: {
            type: Sequelize.STRING,
        },
        start_operating_hour: {
            type: Sequelize.STRING,
        },
        end_operating_hour: {
            type: Sequelize.STRING,
        },
        communicator: {
            type: Sequelize.TEXT('long'),
        },
        peers_count: {
            type: Sequelize.TINYINT,
        },
        status: {
            type: Sequelize.TINYINT,
        },
        isPaid: {
            type: Sequelize.TINYINT,
        },
        uuid: {
            type: Sequelize.STRING,
        },
    });

    return Users_business;
};
