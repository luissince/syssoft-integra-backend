const { currentDate, currentTime, generateNumericCode, generateAlphanumericCode } = require('../../../tools/Tools');

module.exports = ({ conec }) => async function create(body) {
    let connection = null;
    try {
        // Iniciar una transacción
        connection = await conec.beginTransaction();

        // Obtener fecha y hora actuales
        const date = currentDate();
        const time = currentTime();

        const {
            idComprobante,
            idMotivo,
            idVenta,
            fechaRegistro,
            idUsuario,
            idSucursal,
            observacion
        } = body;

        const [{ idCliente, idMoneda }] = await conec.execute(connection, 'SELECT idCliente, idMoneda FROM venta WHERE idVenta = ? LIMIT 1', [idVenta]);

        const comprobante = await conec.execute(connection, `SELECT serie,numeracion FROM comprobante WHERE idComprobante  = ?`, [idComprobante]);

        const ventas = await conec.execute(connection, `SELECT numeracion FROM notaCredito WHERE idComprobante = ?`, [idComprobante]);

        const numeracion = generateNumericCode(comprobante[0].numeracion, ventas, "numeracion");

        const listaNotasCredito = await conec.execute(connection, 'SELECT idNotaCredito FROM notaCredito');
        const idNotaCredito = generateAlphanumericCode("NC0001", listaNotasCredito, 'idNotaCredito');

        // Insertar la nota de crédito
        await conec.execute(connection, `
        INSERT INTO notaCredito (
            idNotaCredito,
            idCliente,
            idUsuario,
            idMoneda,
            idSucursal,
            idComprobante,
            idMotivo,
            idVenta,
            serie,
            numeracion,
            observacion,
            fecha,
            hora
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
            idNotaCredito,
            idCliente,
            idUsuario,
            idMoneda,
            idSucursal,
            idComprobante,
            idMotivo,
            idVenta,
            comprobante[0].serie,
            numeracion,
            observacion,
            date,
            time
        ]);

        const datalles = await conec.execute(connection, `
        SELECT 
            vd.idProducto,
            vd.precio,
            vd.cantidad,
            vd.idImpuesto,
            m.idMedida
        FROM 
            ventaDetalle AS vd
        INNER JOIN
            producto AS p ON vd.idProducto = p.idProducto
        INNER JOIN
            medida AS m ON m.idMedida = p.idMedida
        WHERE 
            idVenta = ?`, [
            idVenta
        ]);

        const listaIdNotaCreditoDetalle = await conec.execute(connection, 'SELECT idNotaCreditoDetalle FROM notaCreditoDetalle');
        let idNotaCreditoDetalle = generateNumericCode(1, listaIdNotaCreditoDetalle, 'idNotaCreditoDetalle');

        for (const detalle of datalles) {
            await conec.execute(connection, `
            INSERT INTO notaCreditoDetalle(
                idNotaCreditoDetalle,
                idNotaCredito,
                idProducto,
                precio,
                cantidad,
                idImpuesto,
                idMedida
            ) VALUES (?,?,?,?,?,?,?)`, [
                idNotaCreditoDetalle,
                idNotaCredito,
                detalle.idProducto,
                detalle.precio,
                detalle.cantidad,
                detalle.idImpuesto,
                detalle.idMedida
            ]);

            idNotaCreditoDetalle++;
        }

        // Confirmar la transacción
        conec.commit(connection);

        // Enviar respuesta exitosa
        return "Se registro correnta la nota de crédito";
    } catch (error) {
        // Manejo de errores: Si hay un error, realiza un rollback y devuelve un mensaje de error
        if (connection != null) {
            await conec.rollback(connection);
        }

        throw error;
    }
}

