module.exports = (sequelize, Sequelize) => {
    const Users_business_characteristics = sequelize.define('users_business_characteristics', {
        business_industry_belong_to: {
            type: Sequelize.STRING,
        },
        business_industry_matching_target: {
            type: Sequelize.STRING,
        },
        business_scale: {
            type: Sequelize.TINYINT,
        },
        business_major_category: {
            type: Sequelize.STRING,
        },
        business_sub_category: {
            type: Sequelize.STRING,
        },
        business_sub_category_str: {
            type: Sequelize.STRING,
        },
        business_minor_sub_category: {
            type: Sequelize.STRING,
        },
        business_minor_sub_category_str: {
            type: Sequelize.STRING,
        },
        top_products_services: {
            type: Sequelize.STRING,
        },
        status: {
            type: Sequelize.TINYINT,
        },
        uuid: {
            type: Sequelize.STRING,
        },
    });

    return Users_business_characteristics;
};
