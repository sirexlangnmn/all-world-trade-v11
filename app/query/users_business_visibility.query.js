const QUERY = {
    CREATE:
        'INSERT INTO users_business_visibilities (' +
        'user_business_id, ' +
        'i_operate_on_a_world_wide_level, ' +
        'i_operate_on_a_global_regional_level, ' +
        'i_operate_on_a_national_level, ' +
        'i_operate_on_a_state_level, ' +
        'visible_to_micro_small_retailers, ' +
        'visible_to_btb_medium_large_wholesale_highend, ' +
        'visible_to_large_scale_and_highend_business, ' +
        'uuid) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?, ?)',
};

module.exports = QUERY;
