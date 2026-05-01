const { currentDate, currentTime, generateAlphanumericCode } = require("../../../tools/Tools");

module.exports = ({ conec }) => async function devolver(data) {
    
    let connection = null;
    try {
        connection = await conec.beginTransaction();

        const date = currentDate();
        const time = currentTime();

        for (const object of data) {
            const resultDocumentoActivo = await conec.execute(connection, 'SELECT idDocumentoActivo FROM documentoactivo');
            const idDocumentoActivo = generateAlphanumericCode("DA0001", resultDocumentoActivo, 'idDocumentoActivo');

            await conec.execute(connection, `
            INSERT INTO documentoactivo(
                idDocumentoActivo,
                tipo,
                idPersona,
                observacion,
                fecha,
                hora,
                idUsuario
            ) VALUES (?,?,?,?,?,?,?)`, [
                idDocumentoActivo,
                object.tipo,
                object.idPersona,
                object.descripicion,
                date,
                time,
                object.idUsuario
            ]);

            for (const activo of object.activos) {
                const resultDocumentoActivoDetalle = await conec.execute(connection, 'SELECT idDocumentoDetalle FROM documentoactivodetalle');
                const idDocumentoDetalle = generateAlphanumericCode("DD0001", resultDocumentoActivoDetalle, 'idDocumentoDetalle');

                await conec.execute(connection, `
                    INSERT INTO documentoactivodetalle(
                        idDocumentoDetalle,
                        idDocumentoActivo,
                        idInventarioActivo,
                        cantidad
                    ) VALUES (?,?,?,?)`, [
                    idDocumentoDetalle,
                    idDocumentoActivo,
                    activo.idInventarioActivo,
                    activo.cantidad
                ]);

                //Actualizar la cantidad de la tabla inventarioActivo
                await conec.execute(connection, `
                    UPDATE 
                        inventarioActivo 
                    SET 
                        cantidad = cantidad + ?, estado = ?
                    WHERE 
                        idInventarioActivo = ?`, [
                    activo.cantidad,
                    `DISPONIBLE`,
                    activo.idInventarioActivo
                ]);
            }

            const resultAsignacionActivo = await conec.execute(connection, 'SELECT idAsignacionActivo FROM asignacionactivo');
            const idAsignacionActivo = generateAlphanumericCode("AA0001", resultAsignacionActivo, 'idAsignacionActivo');

            await conec.execute(connection, `
            INSERT INTO asignacionactivo(
                idAsignacionActivo,
                idDocumentoActivo,
                idPersona,
                fecha,
                hora,
                idUsuario
            ) VALUES (?,?,?,?,?,?)`, [
                idAsignacionActivo,
                idDocumentoActivo,
                object.idPersona,
                date,
                time,
                object.idUsuario
            ]);

            await conec.commit(connection);
            return "Datos insertados correctamente.";
        }
    } catch (error) {
        if (connection != null) {
            await conec.rollback(connection);
        }

        throw error;
    }
}