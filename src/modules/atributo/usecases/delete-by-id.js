
module.exports = ({ conec }) => async function deleteById(data) {
    const { idAtributo } = data;

    let connection = null;
    try {
        connection = await conec.beginTransaction();

        await conec.execute(connection, `DELETE FROM atributo WHERE idAtributo  = ?`, [
            idAtributo
        ]);

        await conec.commit(connection);
        return "Se eliminó correctamente el atributo.";
    } catch (error) {
        if (connection != null) {
            await conec.rollback(connection);
        }

        throw error;
    }
}