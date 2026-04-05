
const bcrypt = require('bcrypt');
const { createToken } = require('../../../tools/Jwt');
const { ClientError } = require('../../../tools/Error');
const { validateUserAccess, getPermisosByPerfil, getUser } = require('./auth.utils');

module.exports = ({ conec }) => async function authenticate(data) {
    // Obtener el usuario
    const validate = await conec.query(`
    SELECT 
        idUsuario, 
        clave
    FROM 
        usuario
    WHERE usuario = ?`, [
        data.username
    ]);

    // Validar el usuario
    if (validate.length === 0) {
        throw new ClientError("Datos incorrectos, intente nuevamente.");
    }

    // Validar la contraseña
    const hash = bcrypt.compareSync(data.password, validate[0].clave);
    if (!hash) {
        throw new ClientError("Datos incorrectos, intente nuevamente.");
    }

    // Obtener el usuario
    const usuario = await getUser(conec, validate[0].idUsuario);

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
