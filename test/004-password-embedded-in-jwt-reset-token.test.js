// Regression guard for docs/tasks/004-Password-Embedded-in-JWT-Reset-Token.md
// (CODE_REVIEW Finding 4 -- password embedded in the unused reset JWT).
//
// Run: node --test test/004-password-embedded-in-jwt-reset-token.test.js
//
// The route is registered inline and the project intentionally has no route
// test harness, so these are source-invariant checks: the reset-token route
// must not contain JWT/AES/password handling, while the real UUID token, link,
// expiry, insert, and response must remain.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROUTE_PATH = path.join(__dirname, '..', 'app', 'routes', 'forgot-password.js');
const CLIENT_PATH = path.join(__dirname, '..', 'public', 'assets', 'js', 'forgot-password.js');

const routeSource = fs.readFileSync(ROUTE_PATH, 'utf8');
const clientSource = fs.readFileSync(CLIENT_PATH, 'utf8');

function createResetTokenBlock() {
    const start = routeSource.indexOf("app.post('/api/post/create-reset-token'");
    const end = routeSource.indexOf("app.post('/api/post/send-email-for-change-password'");
    assert.ok(start !== -1 && end !== -1 && end > start, 'create-reset-token block must exist');
    return routeSource.slice(start, end);
}

test('the reset-token flow does not import or use jsonwebtoken', () => {
    const block = createResetTokenBlock();
    assert.doesNotMatch(block, /require\(['"]jsonwebtoken['"]\)/);
    assert.doesNotMatch(block, /\bjwt\.sign\s*\(/);
});

test('the reset-token flow does not create a password-derived secret or JWT payload', () => {
    const block = createResetTokenBlock();
    assert.doesNotMatch(block, /JWT_SECRET\s*\+/);
    assert.doesNotMatch(block, /\bPAYLOAD\b/);
    assert.doesNotMatch(block, /\bSECRET\b/);
});

test('the reset-token flow does not use CryptoJS/AES', () => {
    const block = createResetTokenBlock();
    assert.doesNotMatch(block, /\bCryptoJS\b/);
    assert.doesNotMatch(block, /AES\.(encrypt|decrypt)/);
});

test('the reset-token flow does not read a password from the request', () => {
    const block = createResetTokenBlock();
    assert.doesNotMatch(block, /req\.body\.password\b/);
    assert.doesNotMatch(block, /\bpassword\s*[:=]/);
});

test('the real UUID token, link, expiration, and insert still exist', () => {
    const block = createResetTokenBlock();
    assert.match(block, /uuidV4\(\)/);
    assert.match(block, /reset-password\//);
    assert.match(block, /60\s*\*\s*60\s*\*\s*1000/);
    assert.match(block, /RESET_TOKENS\.CREATE/);
    assert.match(block, /message:\s*'reset tokens saved'/);
});

test('the forgot-password client no longer reads or sends res.password', () => {
    assert.doesNotMatch(clientSource, /res\.password/);
    assert.doesNotMatch(clientSource, /password\s*:\s*password/);
});

test('the forgot-password client still sends the uuid and email', () => {
    assert.match(clientSource, /createResetToken\(res\.email_or_social_media,\s*res\.uuid\)/);
    assert.match(clientSource, /email_or_social_media:\s*email/);
    assert.match(clientSource, /sendEmailForChangePasswordRequest\(data\)/);
});
