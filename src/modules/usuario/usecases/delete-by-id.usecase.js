
module.exports = ({ conec }) => async function deleteById(idUsuario) {
    let connection = null;
    try {
        connection = await conec.beginTransaction();

        await conec.execute(connection, `DELETE FROM usuario WHERE idUsuario = ?`, [
            idUsuario
        ]);

        await conec.commit(connection);
        return "Se eliminó correctamente el usuario.";
    } catch (error) {
        if (connection != null) {
            await conec.rollback(connection);
        }

        throw error;
    }
}
