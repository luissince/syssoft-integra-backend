const { validarPrivilegio, validarSubMenu, validarMenu } = require("../services/acceso.service");
const { sendForbidden, sendError } = require("../tools/Message");

function validRoute(idMenu = null, idSubMenu = null, idPrivilegio = null) {
    return async (req, res, next) => {

        // Verificar que se haya pasado el menú
        if(!idMenu){
            return sendError(res, {
                message: 'Faltan parámetros.',
            });
        }

        // Obtener el idUsuario del token
        const idUsuario = req.dataToken.idUsuario;

        // Verificación del menú (si se pasa solo el menú)
        if (idMenu) {
            const vm = await validarMenu(idUsuario, idMenu);
            if (!vm) {
                return sendForbidden(res, {
                    message: 'Acceso denegado.',
                });
            }
        }

        // Verificación del submenu (si se pasa el menú y el submenu)
        if (idSubMenu) {
            const vsm = await validarSubMenu(idUsuario, idMenu, idSubMenu);
            if (!vsm) {
                return sendForbidden(res, {
                    message: 'Acceso denegado.',
                });
            }
        }

        // Verificación del privilegio (si se pasan el menú, el submenu y el privilegio)
        if (idPrivilegio) {
            const vpv = await validarPrivilegio(idUsuario, idMenu, idSubMenu, idPrivilegio);
            if (!vpv) {
                return sendForbidden(res, {
                    message: 'Acceso denegado.',
                });
            }
        }

        // Si todo es válido, continuar con la siguiente función
        next();
    };
}

module.exports = validRoute;