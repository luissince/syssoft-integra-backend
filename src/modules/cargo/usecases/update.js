const { currentDate, currentTime } = require("../../../tools/Tools");

module.exports = ({ conec }) => async function update(data) {
    const {
        nombre,
        descripcion,
        estado,
        idUsuario,
        idCargo
    } = data;

    let connection = null;
    try {
        connection = await conec.beginTransaction();

        const date = currentDate();
        const time = currentTime();

        await conec.execute(connection, `
        UPDATE 
            cargo 
        SET
            nombre = ?,
            descripcion = ?,
            estado = ?,
            fupdate = ?,
            hupdate = ?,
            idUsuario = ?
        WHERE 
            idCargo  = ?`, [
            nombre,
            descripcion,
            estado,
            date,
            time,
            idUsuario,
            idCargo,
        ]);

        await conec.commit(connection);
        return "Se actualizó correctamente el cargo.";
    } catch (error) {
        if (connection != null) {
            await conec.rollback(connection);
        }

        throw error;
    }
}