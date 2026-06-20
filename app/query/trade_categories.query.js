const QUERY = {
    SELECT_TRADE_CATEGORIES: 'SELECT * FROM trade_categories',
    //SELECT_TRADE_CATEGORIES_BY_TITLE: `SELECT * FROM trade_categories WHERE title LIKE '%${title}%'`
    SELECT_TRADE_CATEGORIES_FOR_TODAY: 'SELECT * FROM trade_categories WHERE status = 1',
    SELECT_TRADE_CATEGORY_TITLE_BY_ID: 'SELECT title FROM trade_categories WHERE id = ?',
};

// export default QUERY;
module.exports = QUERY;
