const { ClientError } = require("../../../tools/Error");

module.exports = ({ conec }) => async function deleteById(data) {
    const { idArea } = data;

    let connection = null;
    try {
        connection = await conec.beginTransaction();

        const empleado = await conec.execute(connection, `SELECT * FROM empleado WHERE idArea = ?`, [
            idArea
        ]);

        if (empleado.length > 0) {
            throw new ClientError("No se puede eliminar la area ya que esta ligada a un empleado.");
        }

        await conec.execute(connection, `DELETE FROM area WHERE idArea  = ?`, [
            idArea
        ]);

        await conec.commit(connection)
        return "Se eliminó correctamente el area.";
    } catch (error) {
        if (connection != null) {
            await conec.rollback(connection);
        }

        throw error;
    }
}