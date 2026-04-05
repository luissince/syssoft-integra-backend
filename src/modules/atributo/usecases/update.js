const { currentDate, currentTime } = require("../../../tools/Tools");

module.exports = ({ conec }) => async function update(data) {
    const {
        nombre,
        hexadecimal,
        valor,
        estado,
        idUsuario,
        idAtributo
    } = data;

    let connection = null;
    try {
        connection = await conec.beginTransaction();

        const date = currentDate();
        const time = currentTime();

        await conec.execute(connection, `
        UPDATE 
            atributo 
        SET
            nombre = ?,
            hexadecimal = ?,
            valor = ?,
            estado = ?,
            fupdate = ?,
            hupdate = ?,
            idUsuario = ?
        WHERE 
            idAtributo  = ?`, [
            nombre,
            hexadecimal,
            valor,
            estado,
            date,
            time,
            idUsuario,
            idAtributo,
        ]
        );

        await conec.commit(connection);
        return "Se actualizó correctamente la atributo.";
    } catch (error) {
        if (connection != null) {
            await conec.rollback(connection);
        }

        throw error;
    }
}