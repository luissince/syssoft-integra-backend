const { currentDate, currentTime, generateAlphanumericCode } = require("../../../tools/Tools");

module.exports = ({ conec }) => async function create(data) {
    const { tipo, idPersona, observacion, activos, idUsuario } = data;

    let connection = null;
    try {
        connection = await conec.beginTransaction();

        const date = currentDate();
        const time = currentTime();

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
            tipo,
            idPersona,
            observacion,
            date,
            time,
            idUsuario
        ]);

        if (Array.isArray(activos) && activos.length > 0) {
            for (const activo of activos) {

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
                    cantidad = cantidad - ?, estado = ?
                WHERE 
                    idInventarioActivo = ?`, [
                    activo.cantidad,
                    `ASIGNADO`,
                    activo.idInventarioActivo
                ]);
            }
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
            idPersona,
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