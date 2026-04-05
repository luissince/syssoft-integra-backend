const { currentDate, currentTime } = require("../../../tools/Tools");

module.exports = ({ conec }) => async function update(data) {
    const {
        nombre,
        descripcion,
        estado,
        idUsuario,
        idArea
    } = data;

    let connection = null;
    try {
        connection = await conec.beginTransaction();

        const date = currentDate();
        const time = currentTime();

        await conec.execute(connection, `
        UPDATE 
            area 
        SET
            nombre = ?,
            descripcion = ?,
            estado = ?,
            fupdate = ?,
            hupdate = ?,
            idUsuario = ?
        WHERE 
            idArea = ?`, [
            nombre,
            descripcion,
            estado,
            date,
            time,
            idUsuario,
            idArea,
        ]);

        await conec.commit(connection);
        return "Se actualizó correctamente la area.";
    } catch (error) {
        if (connection != null) {
            await conec.rollback(connection);
        }

        throw error;
    }
}