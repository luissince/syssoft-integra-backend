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

    const key = process.env.JWT_SECRET;

    if (!key) {
        return sendForbidden(res, {
            message: 'Acceso denegado'
        });
    }

    // 1. Primero intentar obtener el token desde la cookie
    let token = req.cookies?.token;

    // 2. Opcionalmente mantener compatibilidad con Bearer Token
    if (!token) {

        const bearerToken = req.headers['authorization'];

        if (bearerToken?.startsWith('Bearer ')) {
            token = bearerToken.split(' ')[1];
        }
    }

    // 3. No existe token
    if (!token) {
        return sendNoAutorizado(res, {
            message: 'No autorizado'
        });
    }

    try {
        // 4. Validar y decodificar JWT
        const decoded = jwt.verify(token, key);

        // 5. Guardar payload
        req.dataToken = decoded;

        // 6. Continuar
        next();
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
