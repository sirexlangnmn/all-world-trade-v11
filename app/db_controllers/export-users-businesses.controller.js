const db = require('../db_models');
const Users_business = db.users_businesses;

function escapeCsvField(value) {
    if (value === null || value === undefined) {
        return '';
    }

    const str = String(value);

    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
}

function toCsv(rows) {
    const columns = Object.keys(Users_business.rawAttributes);

    const header = columns.map(escapeCsvField).join(',');

    const body = rows.map((row) => {
        const values = columns.map((column) => {
            const value = row.getDataValue(column);

            if (value instanceof Date) {
                try {
                    return escapeCsvField(value.toISOString());
                } catch (_) {
                    return '';
                }
            }

            return escapeCsvField(value);
        });

        return values.join(',');
    });

    return `${header}\n${body.join('\n')}\n`;
}

exports.exportAll = async (req, res) => {
    try {
        const allRows = await Users_business.findAll();

        const csv = toCsv(allRows);

        res.attachment('users_businesses.csv');

        return res.send(csv);
    } catch (error) {
        return res.status(500).json({ message: 'server error', error: error.message });
    }
};