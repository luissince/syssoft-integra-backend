const { currentDate, currentTime } = require("../../../tools/Tools");

module.exports = ({ conec }) => async function create(data) {
    const {
        idTipoAtributo,
        nombre,
        hexadecimal,
        valor,
        estado,
        idUsuario
    } = data;

    let connection = null;
    try {
        connection = await conec.beginTransaction();

        const date = currentDate();
        const time = currentTime();

        const result = await conec.execute(connection, "SELECT idAtributo FROM atributo");
        const idAtributo = generateAlphanumericCode("AT0001", result, 'idAtributo');

        await conec.execute(connection, `
        INSERT INTO atributo(
            idAtributo,
            idTipoAtributo,
            nombre,
            hexadecimal,
            valor,
            estado,
            fecha,
            hora,
            fupdate,
            hupdate,
            idUsuario
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [
            idAtributo,
            idTipoAtributo,
            nombre,
            hexadecimal,
            valor,
            estado,
            date,
            time,
            date,
            time,
            idUsuario,
        ]);

        await conec.commit(connection);
        return "Se registró correctamente la atributo.";
    } catch (error) {
        if (connection != null) {
            await conec.rollback(connection);
        }

        throw error;
    }
}