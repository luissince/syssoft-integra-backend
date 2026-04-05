const { currentDate, currentTime } = require("../../../tools/Tools");

module.exports = ({ conec }) => async function create(data) {
    const { idPersona, idProducto, descripcion, serie } = data;

    let connection = null;
    try {
        connection = await conec.beginTransaction();

        const date = currentDate();
        const time = currentTime();

        const result = await conec.execute(connection, 'SELECT idActivoGestion FROM activoGestion');
        const idActivoGestion = generateAlphanumericCode("AG0001", result, 'idActivoGestion');

        await conec.execute(connection, `
        INSERT INTO activoGestion(
            idActivoGestion,
            idPersona,
            idProducto,
            descripcion
            serie,
            fecha,
            hora
        ) VALUES (?,?,?,?,?,?,?)`, [
            idActivoGestion,
            idPersona,
            idProducto,
            descripcion,
            serie,
            date,
            time
        ]);

        await conec.commit(connection);
        return "Datos insertados correctamente.";
    } catch (error) {
        if (connection != null) {
            await conec.rollback(connection);
        }

        throw error;
    }
}