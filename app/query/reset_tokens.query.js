const QUERY = {
    CREATE:
        'INSERT INTO reset_tokens (' +
        'token, ' +
        'expiration, ' +
        'uuid, ' +
        'createdAt, ' +
        'updatedAt) VALUES' +
        '(?, ?, ?, ?, ?)',
};

module.exports = QUERY;
