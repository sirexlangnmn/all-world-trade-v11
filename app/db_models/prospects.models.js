module.exports = (sequelize, Sequelize) => {
    const Prospects = sequelize.define('prospects', {
        email_address: {
            type: Sequelize.STRING,
        },
        contact_number: {
            type: Sequelize.STRING,
        },
        fullname: {
            type: Sequelize.STRING,
        },
        source_link: {
            type: Sequelize.STRING,
        },
        category: {
            type: Sequelize.TINYINT,
        },
        uuid: {
            type: Sequelize.STRING,
        },
    });

    return Prospects;
};
