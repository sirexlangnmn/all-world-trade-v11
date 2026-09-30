// Coerce a request-supplied value into a scalar that is safe to bind as a
// query value.
//
// Strings pass through byte-for-byte unchanged -- callers that need no
// trim / toLowerCase / email normalization must not get it here, because the
// stored lookup key depends on the exact bytes the user typed. Numbers and
// booleans are stringified. Everything else (null, undefined, arrays, plain
// objects) is dropped, which is what stops a Sequelize operator such as
// { [Op.ne]: null } from being smuggled in as a value.
//
// Shared by app/services/auth.service.js and
// app/services/business-search.service.js.
function toScalar(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return undefined;
}

module.exports = { toScalar };
