const QUERY = {
    CREATE:
        'INSERT INTO users_accounts (' +
        'user_id, ' +
        'social_media_contact_type, ' +
        'contact_number, ' +
        'email_or_social_media, ' +
        'password, ' +
        'type, ' +
        'verification_code, ' +
        'uuid) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?)',

    SELECT_CURRENT_VISITOR: `SELECT 
            users_accounts.email_or_social_media, 
            users_accounts.social_media_contact_type,
            users_accounts.contact_number, 
            users.first_name, 
            users.last_name, 
            users.middle_name
            FROM users_accounts 
            JOIN users 
            ON users_accounts.uuid = users.uuid 
            WHERE users_accounts.uuid = ? `,

    UPDATE_PASSWORD: `UPDATE users_accounts SET 
			password = ?
			WHERE uuid = ?`,

    GET_BY_EMAIL: `SELECT 
			email_or_social_media, 
			password, 
			uuid
            FROM users_accounts 
            WHERE email_or_social_media = ? `,

    GET_PASSWORD: `SELECT 
			password
            FROM users_accounts 
            WHERE uuid = ? `,

    // SELECT_CURRENT_VISITOR: `SELECT
    //     users_accounts.email_or_social_media,
    //     users_accounts.contact_number,
    //     users.first_name,
    //     users.last_name,
    //     users.middle_name
    //     FROM users_accounts
    //     JOIN users
    //     ON users_accounts.uuid = users.uuid
    //     WHERE users_accounts.uuid = ? `,
};

module.exports = QUERY;
