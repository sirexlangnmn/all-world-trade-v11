const QUERY = {
    CREATE: 'INSERT INTO users (' + 'first_name, ' + 'last_name, ' + 'uuid) VALUES' + '(?, ?, ?)',
};

module.exports = QUERY;
