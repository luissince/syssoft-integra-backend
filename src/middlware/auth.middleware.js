const jwt = require('jsonwebtoken');
const { sendNoAutorizado, sendForbidden } = require('../tools/Message');

/**
 * Middleware para extraer y verificar un token JWT.
 * 
 * @param {Object} req - Objeto de solicitud HTTP.
 * @param {Object} res - Objeto de respuesta HTTP.
 * @param {Function} next - Función para pasar al siguiente middleware.
 */
function authenticate(req, res, next) {
    const headers = req.headers;

    // Validar que existan encabezados y el token.
    if (!req || !headers) {
        return sendNoAutorizado(res, { message: 'No autorizado' });
    }

    const bearerToken = headers['authorization'];

    if (!bearerToken || !bearerToken.startsWith('Bearer ')) {
        return sendNoAutorizado(res, { message: 'No autorizado' });
    }

    const token = bearerToken.split(" ")[1]; // Extraer el token.
    const key = process.env.TOKEN_ACCESS;

    if (!token || !key) {
        return sendForbidden(res, { message: 'Acceso denegado' });
    }

    try {
        // Verificar y decodificar el token.
        const decoded = jwt.verify(token, key);
        req.dataToken = decoded; // Almacenar datos decodificados en `req`.
        next(); // Continuar al siguiente middleware o controlador.
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return sendNoAutorizado(res, {
                message: 'El token ha expirado. Por favor, inicia sesión de nuevo.',
            });
        }
        return sendForbidden(res, { message: 'Acceso denegado' });
    }
}

module.exports = authenticate;
