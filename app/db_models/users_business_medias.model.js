module.exports = (sequelize, Sequelize) => {
    const Users_business_medias = sequelize.define('users_business_medias', {
        logo: {
            type: Sequelize.STRING,
        },
        banner: {
            type: Sequelize.STRING,
        },
        video_thumbnail: {
            type: Sequelize.STRING,
        },
        video_link: {
            type: Sequelize.STRING,
        },
        video_title: {
            type: Sequelize.STRING,
        },
        video_description: {
            type: Sequelize.STRING,
        },
        brochure: {
            type: Sequelize.STRING,
        },
        brochure_title: {
            type: Sequelize.STRING,
        },
        webinars_thumbnail: {
            type: Sequelize.STRING,
        },
        webinars_title: {
            type: Sequelize.STRING,
        },
        webinars_description: {
            type: Sequelize.STRING,
        },
        webinars_link: {
            type: Sequelize.STRING,
        },
        webinars_schedule: {
            type: Sequelize.DATE,
        },
        status: {
            type: Sequelize.TINYINT,
        },
        uuid: {
            type: Sequelize.STRING,
        },
        date_created: {
            type: Sequelize.DATE,
        },
    });

    return Users_business_medias;
};
