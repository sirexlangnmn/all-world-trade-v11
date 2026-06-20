const QUERY = {
    CREATE:
        'INSERT INTO users_business_characteristics (' +
        'user_business_id, ' +
        'business_industry_belong_to, ' +
        'business_major_category, ' +
        'business_sub_category, ' +
        'business_sub_category_str, ' +
        'business_minor_sub_category, ' +
        'business_minor_sub_category_str, ' +
        'business_scale, ' +
        'uuid) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?, ?)',

    CREATE_OLD:
        'INSERT INTO users_business_characteristics (' +
        'user_business_id, ' +
        'business_industry_belong_to, ' +
        'business_major_category, ' +
        'business_sub_category, ' +
        'business_minor_sub_category, ' +
        'business_scale, ' +
        'uuid) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?)',

    UPDATE: `UPDATE users_business_characteristics SET 
			business_industry_belong_to = ?,
            business_major_category = ?, 
            business_sub_category = ?, 
            business_sub_category_str = ?, 
            business_minor_sub_category = ?, 
            business_minor_sub_category_str = ?,
            business_scale = ?
            WHERE uuid = ?`,

    BUSINESS_SCALE: `SELECT
			business_scale
			FROM users_business_characteristics 
			WHERE uuid = ? `,

    // BUSINESS_CHARACTERISTIC: `SELECT
    // 		trade_categories.title AS trade_categories,
    // 		sub_categories.title AS sub_categories,
    // 		minor_sub_categories.title AS minor_sub_categories,
    // 		users_business_characteristics.business_sub_category_str AS business_sub_category_str,
    // 		users_business_characteristics.business_minor_sub_category_str AS business_minor_sub_category_str,
    // 		users_business_characteristics.business_industry_belong_to AS business_industry_belong_to,
    // 		users_business_characteristics.business_scale AS business_scale
    // 		FROM users_business_characteristics
    // 		JOIN trade_categories
    // 		ON trade_categories.id = users_business_characteristics.business_major_category
    // 		JOIN sub_categories
    // 		ON sub_categories.id = users_business_characteristics.business_sub_category
    // 		JOIN minor_sub_categories
    // 		ON minor_sub_categories.id = users_business_characteristics.business_minor_sub_category
    // 		WHERE uuid = ? `,

    BUSINESS_CHARACTERISTIC: `SELECT
			business_major_category,
			business_sub_category,
			business_minor_sub_category,
			business_sub_category_str,
			business_minor_sub_category_str,
			business_industry_belong_to,
			business_scale
			FROM users_business_characteristics
			WHERE uuid = ? `,
};

module.exports = QUERY;
