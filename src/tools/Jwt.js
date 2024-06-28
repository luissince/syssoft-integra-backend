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
        const decoded = jwt.verify(req.token, 'userkeylogin');
        req.idUsuario = decoded.idUsuario;
        next();
    } catch (err) {
        return res.status(403).send("Acceso denegado.");
    }
}

function token(req, res, next) {
    const bearerToken = req.headers['authorization'];

    if (typeof bearerToken !== 'undefined') {
        const token = bearerToken.split(" ")[1];
        req.token = token;
        next();
    } else {
        return res.status(401).send("No autorizado.");
    }
}

module.exports = { create, verify, token }