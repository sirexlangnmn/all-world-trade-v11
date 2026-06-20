const QUERY = {
    // SELECT_CURRENT_VISITOR: 'SELECT * FROM traders_visitors WHERE traders_id = ?',
    // SELECT_CURRENT_VISITOR: 'SELECT * FROM traders_visitors WHERE date_created = (SELECT MAX(date_created) FROM traders_visitors) LIMIT 1 AND traders_id = ?',
    // SELECT_CURRENT_VISITOR: 'SELECT * FROM traders_visitors ORDER BY id DESC WHERE traders_id = ?',
    SELECT_CURRENT_VISITOR:
        'SELECT * FROM traders_visitors WHERE trader_id = ? ORDER BY id DESC, date_created DESC limit 1',

    CREATE:
        'INSERT INTO traders_visitors (' +
        'visitor_id, ' +
        'trader_id, ' +
        'date_created, ' +
        'createdAt, ' +
        'updatedAt) VALUES' +
        '(?, ?, ?, ?, ?)',
};

// export default QUERY;
module.exports = QUERY;
