module.exports = (app) => {
    const bcrypt = require('bcrypt');

    app.post(['/api/post/password-hashing'], async (req, res) => {
        let password = req.body.password;
        const saltRounds = 10;

        const hashedPassword = await new Promise((resolve, reject) => {
            bcrypt.hash(password, saltRounds, function (err, hash) {
                if (err) reject(err);
                resolve(hash);
            });
        });

        res.send(hashedPassword);
    });

    app.post(['/api/post/compare-password'], async (req, res) => {
        let plainPassword = req.body.plainPassword;
        let hashedPassword = req.body.hashedPassword;

        const output = await new Promise((resolve, reject) => {
            bcrypt.compare(plainPassword, hashedPassword, function (err, result) {
                if (err) reject(err);
                resolve(result);
            });
        });

        if (output == false) {
            req.session.destroy();
            req.session = null;
        }

        res.send(output);
    });
};
