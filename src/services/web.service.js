const { currentDate, currentTime, generateAlphanumericCode } = require('../tools/Tools');
const conec = require('../database/mysql-connection');

class Web {

    async id(req) {
        const web = await conec.query(`
        SELECT
            w.idWeb,
            w.idSucursal,
            w.idAlmacen
        FROM 
            web AS w
        LIMIT 1`);

        return {
            success: web.length > 0,
            data: web[0]
        };
    }

    async create(req) {
        let connection = null;
        try {
            // Inicia una transacción de la base de datos
            connection = await conec.beginTransaction();

            // Extrae los datos relevantes de la solicitud
            const {
                idSucursal,
                idAlmacen,
                idUsuario
            } = req.body;

            // Obtener fechas actuales
            const date = currentDate();
            const time = currentTime();

            // Obtener datos de la web
            const web = await conec.query(`
            SELECT
                idWeb
            FROM
                web
            LIMIT 1`);

            if (web.length !== 0) {
                await conec.execute(connection, `
                UPDATE 
                    web 
                SET 
                    idSucursal = ?,
                    idAlmacen = ?,
                    fecha = ?,
                    hora = ?,
                    idUsuario = ?
                WHERE 
                    idWeb = ?`, [
                    idSucursal,
                    idAlmacen,
                    date,
                    time,
                    idUsuario,
                    web[0].idWeb
                ]);
            } else {
                // Genera un nuevo código alfanumérico para el traslado
                const result = await conec.execute(connection, 'SELECT idWeb FROM web');
                const idWeb = generateAlphanumericCode("WC0001", result, 'idWeb');

                // Inserta un nuevo registro en la tabla traslado
                await conec.execute(connection, `
                INSERT INTO web(
                    idWeb,
                    idSucursal,
                    idAlmacen,
                    fecha,
                    hora,
                    idUsuario
                ) VALUES(?,?,?,?,?,?)`, [
                    idWeb,
                    idSucursal,
                    idAlmacen,
                    date,
                    time,
                    idUsuario
                ]);
            }

            // Realiza un rollback para confirmar la operación y devuelve un mensaje de éxito
            await conec.commit(connection);
            return "Se completo correctamente el proceso.";
        } catch (error) {
            // Manejo de errores: Si hay un error, realiza un rollback y devuelve un mensaje de error
            if (connection != null) {
                await conec.rollback(connection);
            }

            throw error;
        }
    }
}

module.exports = new Web();