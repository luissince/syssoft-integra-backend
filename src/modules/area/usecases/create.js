const { currentDate, currentTime } = require("../../../tools/Tools");

module.exports = ({ conec }) => async function create(data) {
    const { nombre, descripcion, estado, idUsuario } = data;

    let connection = null;
    try {
        connection = await conec.beginTransaction();

        const date = currentDate();
        const time = currentTime();

        const result = await conec.execute(connection, 'SELECT idArea FROM area');
        const idArea = generateAlphanumericCode("AR0001", result, 'idArea');

        await conec.execute(connection, `
        INSERT INTO area(
            idArea,
            nombre,
            descripcion,
            estado,
            fecha,
            hora,
            idUsuario
        ) VALUES (?,?,?,?,?,?,?)`, [
            idArea,
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