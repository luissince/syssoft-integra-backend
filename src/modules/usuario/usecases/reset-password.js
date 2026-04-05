
const bcrypt = require('bcrypt');
const saltRounds = 10;

module.exports = ({ conec }) => async function resetPassword(data) {
    let connection = null;
    try {
        connection = await conec.beginTransaction();

        const salt = bcrypt.genSaltSync(saltRounds);
        const hash = bcrypt.hashSync(data.clave, salt);

        await conec.execute(connection, `
        UPDATE 
            usuario 
        SET
            clave = ?
        WHERE 
            idUsuario=?`, [
            hash,
            data.idUsuario
        ]);

        await conec.commit(connection)
        return "Se actualizó la contraseña correctamente.";
    } catch (error) {
        if (connection != null) {
            await conec.rollback(connection);
        }
        throw error;
    }
}
