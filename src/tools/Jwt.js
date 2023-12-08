const jwt = require('jsonwebtoken');

function create(user, key, expiresIn = '10h') {
    return new Promise((resolve, reject) => {
        jwt.sign(user, key, { expiresIn: expiresIn }, (error, token) => {
            if (error) {
                reject("error");
            } else {
                resolve(token);
            }
        });
    });
}

function verify(req, res, next) {
    try {
        jwt.verify(req.token, 'userkeylogin');
        next();
    } catch (err) {
        res.sendStatus(403);
    }
}

function token(req, res, next) {
    const bearerToken = req.headers['authorization'];

    if (typeof bearerToken !== 'undefined') {
        const token = bearerToken.split(" ")[1];
        req.token = token;
        next();
    } else {
        res.sendStatus(401);
    }
}

module.exports = { create, verify, token }