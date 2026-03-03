
const bcrypt = require('bcrypt');
const saltRounds = 10;
const { generateAlphanumericCode } = require('../../../tools/Tools');
const { ClientError } = require('../../../tools/Error');

module.exports = ({ conec }) => async function create(data) {
    let connection = null;
    try {
        connection = await conec.beginTransaction();

        const resultUsuario = await conec.execute(connection, 'SELECT idUsuario FROM usuario');
        const idUsuario = generateAlphanumericCode("US0001", resultUsuario, 'idUsuario');

        const salt = bcrypt.genSaltSync(saltRounds);
        const hash = bcrypt.hashSync(data.clave, salt);

        await conec.execute(connection, `
        INSERT INTO usuario(
            idUsuario,
            idPersona,
            idPerfil,
            usuario,
            clave,
            estado
        ) VALUES(?,?,?,?,?,?)`, [
            idUsuario,
            data.idPersona,
            data.idPerfil,
            data.usuario,
            hash,
            data.estado,
        ])

        await conec.commit(connection);
        return "Los datos se registrarón correctamente.";
    } catch (error) {
         // ✅ Siempre hacer rollback primero
        if (connection != null) {
            await conec.rollback(connection);
        }

        // Luego ya manejas el error
        if (error.code === 'ER_DUP_ENTRY') {
            throw new ClientError("El nombre de usuario ya existe.");
        }

        throw error;
    }
}
