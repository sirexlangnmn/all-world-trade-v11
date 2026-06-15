module.exports = (sequelize, Sequelize) => {
    const Users_business_visibility = sequelize.define('users_business_visibility', {
        i_operate_on_a_world_wide_level: {
            type: Sequelize.TINYINT,
        },
        i_operate_on_a_global_regional_level: {
            type: Sequelize.TINYINT,
        },
        i_operate_on_a_national_level: {
            type: Sequelize.TINYINT,
        },
        i_operate_on_a_state_level: {
            type: Sequelize.TINYINT,
        },
        i_operate_on_a_city_level: {
            type: Sequelize.TINYINT,
        },
        visible_to_micro_small_retailers: {
            type: Sequelize.TINYINT,
        },
        visible_to_btb_medium_large_wholesale_highend: {
            type: Sequelize.TINYINT,
        },
        visible_to_large_scale_and_highend_business: {
            type: Sequelize.TINYINT,
        },
        uuid: {
            type: Sequelize.STRING,
        },
    });

    return Users_business_visibility;
};
