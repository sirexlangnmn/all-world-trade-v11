'use strict';

// Helmet does not set Permissions-Policy. The marketplace opens MiroTalk in a
// separate tab, so camera/microphone are not needed on this origin. No feature
// in the client code uses geolocation, payment, or USB APIs.
const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=(), usb=()';

function permissionsPolicyMiddleware(req, res, next) {
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    next();
}

module.exports = {
    PERMISSIONS_POLICY,
    permissionsPolicyMiddleware,
};
