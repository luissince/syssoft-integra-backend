const { ClientError } = require("../../../tools/Error");

module.exports = ({ conec }) => async function deleteById(data) {
    const { idCargo } = data;

    let connection = null;
    try {
        connection = await conec.beginTransaction();

        const empleado = await conec.execute(connection, `SELECT * FROM empleado WHERE idCargo = ?`, [
            idCargo
        ]);

        if (empleado.length > 0) {
            throw new ClientError("No se puede eliminar el cargo ya que esta ligado a un empleado.");
        }

        await conec.execute(connection, `DELETE FROM cargo WHERE idCargo  = ?`, [
            idCargo
        ]);

        await conec.commit(connection)
        return "Se eliminó correctamente el cargo.";
    } catch (error) {
        if (connection != null) {
            await conec.rollback(connection);
        }
        
        throw error;
    }
}