const QUERY = {
    CREATE:
        'INSERT INTO users_businesses (' +
        'user_id, ' +
        'business_name, ' +
        'business_email, ' +
        'business_contact, ' +
        'business_language_of_communication, ' +
        'business_tagline, ' +
        'business_website, ' +
        'business_social_media_contact_type, ' +
        'business_social_media_contact_number, ' +
        'business_address, ' +
        'business_country, ' +
        'business_states, ' +
        'business_city, ' +
        'region_of_operation, ' +
        'country_of_operation, ' +
        'states_of_operation, ' +
        'city_of_operation, ' +
        'start_operating_hour, ' +
        'end_operating_hour, ' +
        'communicator, ' +
        'uuid) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',

    UPDATE: `UPDATE users_businesses SET 
            business_name = ?,
            business_email = ?, 
            business_contact = ?, 
            business_language_of_communication = ?, 
            business_tagline = ?, 
            business_website = ?, 
            business_social_media_contact_type = ?, 
            business_social_media_contact_number = ?, 
            business_address = ?, 
            business_country = ?, 
            business_states = ?, 
            business_city = ?, 
            region_of_operation = ?,
            country_of_operation = ?,
            country_for_state = ?,
            states_of_operation = ?,
            city_of_operation = ?,
            start_operating_hour = ?,
            end_operating_hour = ?
            WHERE uuid = ?`,

    LANGUAGE: `SELECT
			business_language_of_communication
			FROM users_businesses 
			WHERE uuid = ? `,

    DETAILS: `SELECT
			business_name,
			business_website,
			business_email,
			business_contact,
			business_address,
			business_country,
			business_states,
			business_city,
			region_of_operation,
			country_of_operation,
			states_of_operation
			FROM users_businesses 
			WHERE uuid = ? `,

    UPDATE_COMMUNICATOR_LINK: `UPDATE users_businesses SET
            communicator = ?
            WHERE uuid = ?`,

    GET_TRADER_COMMUNICATOR: `SELECT
			communicator
			FROM users_businesses
			WHERE uuid = ? `,

    GET_PEERS_COUNT: `SELECT
			peers_count
			FROM users_businesses
			WHERE uuid = ? `,

    // GET_COMMUNICATOR: `SELECT
    // 		communicator
    // 		FROM users_businesses
    // 		WHERE communicator = ? `,

    // GET_COMMUNICATOR: `SELECT
    // 		communicator
    // 		FROM users_businesses
    // 		LIKE '%${params.section_id}%'`,
};

module.exports = QUERY;
