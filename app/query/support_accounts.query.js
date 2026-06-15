const QUERY = {
    CREATE:
        'INSERT INTO support_accounts (' +
        'first_name, ' +
        'last_name, ' +
        'email_address, ' +
        'password, ' +
        'uuid) VALUES' +
        '(?, ?, ?, ?, ?)',
};

module.exports = QUERY;
