const { ClientError } = require('../../../tools/Error');
const { currentDate, currentTime } = require('../../../tools/Tools');
const { KARDEX_TYPES, KARDEX_MOTIVOS } = require('../../../config/constants');

module.exports = ({ conec }) => async function xml(data) {
    let connection = null;
    try {
        const { idVenta, idUsuario } = data;

        // Iniciar una transacción
        connection = await conec.beginTransaction();

        // Obtener fecha y hora actuales
        const date = currentDate();
        const time = currentTime();

        // Obtener información de la venta para el id proporcionado
        const validate = await conec.execute(connection, `
        SELECT 
            serie, 
            numeracion, 
            estado 
        FROM 
            venta 
        WHERE 
            idVenta = ?`, [
            idVenta
        ]);

        // Verificar si la venta existe
        if (validate.length === 0) {
            throw new ClientError("La venta no existe, verifique el código o actualiza la lista.");
        }

        // Verificar si la venta ya está anulada
        if (validate[0].estado === 3) {
            throw new ClientError("La venta ya se encuentra anulada.");
        }

        // Actualizar el estado de la venta a anulado
        await conec.execute(connection, `
        UPDATE 
            venta 
        SET 
            estado = 3 
        WHERE 
            idVenta = ?`, [
            idVenta
        ]);

        // Actualizar el estado de transacción
        await conec.execute(connection, `
        UPDATE 
            transaccion 
        SET 
            estado = 0 
        WHERE 
            idReferencia = ?`, [
            idVenta
        ]);

        // Obtener detalles de la venta
        const detalleVenta = await conec.execute(connection, `
        SELECT 
            idProducto, 
            precio, 
            cantidad 
        FROM 
            ventaDetalle 
        WHERE 
            idVenta = ?`, [
            idVenta
        ]);

        // Obtener el máximo idKardex existente
        const resultKardex = await conec.execute(connection, `SELECT idKardex FROM kardex`);
        let idKardex = resultKardex.length ? Math.max(...resultKardex.map(k => parseInt(k.idKardex.replace("KD", '')))) : 0;

        const generarIdKardex = () => `KD${String(++idKardex).padStart(4, '0')}`;

        // Procesar cada detalle de la venta
        for (const detalle of detalleVenta) {
            // Obtener registros de kardex relacionados con esta venta y producto
            const kardexes = await conec.execute(connection, `
            SELECT 
                k.idProducto,
                k.cantidad,
                k.costo,
                k.idAlmacen,
                k.lote,
                k.idUbicacion,
                k.fechaVencimiento
            FROM 
                kardex AS k 
            WHERE 
                k.idVenta = ? AND k.idProducto = ?`, [
                idVenta,
                detalle.idProducto
            ]);

            for (const kardex of kardexes) {
                // Insertar registro en kardex para anulación con lote
                await conec.execute(connection, `
                    INSERT INTO kardex(
                        idKardex,
                        idProducto,
                        idTipoKardex,
                        idMotivoKardex,
                        idVenta,
                        detalle,
                        cantidad,
                        costo,
                        idAlmacen,
                        lote,
                        idUbicacion,
                        fechaVencimiento,
                        fecha,
                        hora,
                        idUsuario
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                    generarIdKardex(),
                    kardex.idProducto,
                    KARDEX_TYPES.INGRESO,
                    KARDEX_MOTIVOS.DEVOLUCION,
                    idVenta,
                    'ANULACIÓN DE LA VENTA',
                    kardex.cantidad,
                    kardex.costo,
                    kardex.idAlmacen,
                    kardex.lote,
                    kardex.idUbicacion,
                    kardex.fechaVencimiento,
                    date,
                    time,
                    idUsuario
                ]);
            }
        }

        // Registrar auditoría
        await conec.execute(connection, `    
        INSERT INTO auditoria(
            idReferencia,
            idUsuario,
            tipo,
            descripción
        ) VALUES(?,?,?,?)`, [
            idVenta,
            idUsuario,
            "ELIMINAR",
            "SE ANULO LA VENTA",
            date,
            time,
        ]);

        // Confirmar la transacción
        await conec.commit(connection);

        // Enviar respuesta exitosa
        return "Se anuló correctamente la venta.";
    } catch (error) {
        // Manejo de errores: Si hay un error, realiza un rollback y devuelve un mensaje de error
        if (connection != null) {
            await conec.rollback(connection);
        }

        throw error;
    }
}

