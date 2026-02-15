const { ClientError } = require("../../../tools/Error");

module.exports = ({ conec }) => async function update(idUsuario, data) {
    const { idPerfil, estado, usuario } = data;

    let connection = null;
    try {
        connection = await conec.beginTransaction();

        await conec.execute(connection, `
        UPDATE 
            usuario 
        SET 
            idPerfil = ?,
            estado = ?,
            usuario = ?
        WHERE   
            idUsuario = ?`, [
            idPerfil,
            estado,
            usuario,
            idUsuario
        ])

        await conec.commit(connection)

        return "Se actualizó correctamente el usuario.";
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
