const QUERY = {
    SELECT_ROW: 'SELECT * FROM users_business_medias WHERE uuid = ?',
};

const MEDIA_COLUMN_ALLOWLIST = new Set([
    'logo',
    'banner',
    'video',
    'video_thumbnail',
    'video_link',
    'video_title',
    'video_description',
    'brochure',
    'brochure_title',
    'webinars_thumbnail',
    'webinars_title',
    'webinars_description',
    'webinars_link',
    'webinars_schedule',
    'uuid',
    'date_created',
]);

function getAllowedColumns(values) {
    const columns = Object.keys(values);
    if (columns.length === 0 || columns.some((column) => !MEDIA_COLUMN_ALLOWLIST.has(column))) {
        throw new Error('Invalid business media columns.');
    }
    return columns;
}

function buildInsert(values) {
    const columns = getAllowedColumns(values);
    return {
        query: `INSERT INTO users_business_medias (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        values: columns.map((column) => values[column]),
    };
}

function buildUpdate(values, uuid) {
    const columns = getAllowedColumns(values).filter((column) => column !== 'uuid');
    if (columns.length === 0) {
        throw new Error('At least one business media column must be updated.');
    }
    return {
        query: `UPDATE users_business_medias SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE uuid = ?`,
        values: [...columns.map((column) => values[column]), uuid],
    };
}

module.exports = Object.assign(QUERY, { buildInsert, buildUpdate });
