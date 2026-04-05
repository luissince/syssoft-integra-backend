const { currentDate, currentTime } = require("../../../tools/Tools");

module.exports = ({ conec }) => async function create(data) {
    const {nombre, descripcion, estado, idUsuario} = data;

    let connection = null;
    try {
        connection = await conec.beginTransaction();

        const date = currentDate();
        const time = currentTime();

        const result = await conec.execute(connection, 'SELECT idCargo FROM cargo');
        const idCargo = generateAlphanumericCode("CG0001", result, 'idCargo');

        await conec.execute(connection, `
        INSERT INTO cargo(
            idCargo,
            nombre,
            descripcion,
            estado,
            fecha,
            hora,
            idUsuario
        ) VALUES (?,?,?,?,?,?,?)`, [
            idCargo,
            nombre,
            descripcion,
            estado,
            date,
            time,
            idUsuario
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