const jwt = require('jsonwebtoken');

/**
 * Crea un token JWT basado en los datos del usuario y una clave secreta.
 * 
 * @param {Object} user - Información del usuario que se incluirá en el token.
 * @param {string} key - Clave secreta para firmar el token.
 * @param {string} [expiresIn='10h'] - Tiempo de expiración del token (por defecto 10 horas).
 * @returns {Promise<string>} - Una promesa que resuelve con el token JWT generado.
 */
function createToken(user, key, expiresIn = '10h') {
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

module.exports = { createToken }