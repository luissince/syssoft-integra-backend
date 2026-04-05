
const { createToken } = require('../../../tools/Jwt');
const { ClientError } = require('../../../tools/Error');
const { validateUserAccess, getPermisosByPerfil, getUser } = require('./auth.utils');

module.exports = ({ conec }) => async function refreshToken(idUsuario) {
    // Obtener el usuario
    const usuario = await getUser(conec, idUsuario);

    // Validar el usuario
    if (!usuario) {
        throw new ClientError("Usuario no encontrado.");
    }

    // Crear el payload
    const payload = { ...usuario }

    // Validar el acceso
    await validateUserAccess(payload);

    // Crear el token
    const token = await createToken(payload, process.env.TOKEN_ACCESS);

    // Obtener los menus
    const menus = await getPermisosByPerfil(conec, payload.idPerfil);

    // Retornar el token, menus y usuario
    return {
        token,
        menus,
        usuario: payload
    };
}
