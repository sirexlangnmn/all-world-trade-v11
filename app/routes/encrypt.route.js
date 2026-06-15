module.exports = (app) => {
    const CryptoJS = require('crypto-js');
    const JWT_SECRET = process.env.JWT_SECRET;

    app.post(['/api/v2/post/ec'], (req, res) => {
        const ciphertext = CryptoJS.AES.encrypt('my message abc 123 - isa pa', JWT_SECRET).toString();
        console.log('ciphertext', ciphertext);
    });

    app.post(['/api/v2/post/dc'], (req, res) => {
        let ciphertext = 'U2FsdGVkX1+LbDrgi5vMKdTtttXvF4Sa/HBBt47W0BzMjTAiFPYLreYpxi3rSBW/JjexNeL65zdSO+MQcnBmsQ==';
        const bytes = CryptoJS.AES.decrypt(ciphertext, JWT_SECRET);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        console.log('originalText', originalText);
    });
};
