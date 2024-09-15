const { currentDate, currentTime, generateNumericCode, generateAlphanumericCode } = require('../tools/Tools');
const Conexion = require('../database/Conexion');
const { sendSuccess, sendError, sendSave, sendClient } = require('../tools/Message');
const conec = new Conexion();

class Cobro {

    async list(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Cobros(?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_Cobros_Count(?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/list", error);
        }
    }

    async create(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const {
                idPersona,
                idUsuario,
                idMoneda,
                idSucursal,
                idComprobante,
                estado,
                observacion,
                idConcepto,
                monto,
                notaTransacion,
                bancosAgregados,
            } = req.body;

            /**
            * Generar un código unico para el cobro. 
            */
            const resultCobro = await conec.execute(connection, 'SELECT idCobro FROM cobro');
            const idCobro = generateAlphanumericCode("CB0001", resultCobro, 'idCobro');

            /**
            * Obtener la serie y numeración del comprobante.
            */

            const comprobante = await conec.execute(connection, `
            SELECT 
                serie,
                numeracion 
            FROM 
                comprobante 
            WHERE 
                idComprobante  = ?
            `, [
                idComprobante
            ]);

            const cobros = await conec.execute(connection, `
            SELECT 
                numeracion  
            FROM 
                cobro 
            WHERE 
                idComprobante = ?`, [
                idComprobante
            ]);

            const numeracion = generateNumericCode(comprobante[0].numeracion, cobros, "numeracion");

            /**
             * Proceso para ingresar el cobro.
             */

            // Proceso de registro
            await conec.execute(connection, `
            INSERT INTO cobro(
                idCobro,
                idPersona,
                idUsuario,
                idMoneda,
                idSucursal,
                idComprobante,
                serie,
                numeracion,
                estado,
                observacion,
                fecha,
                hora
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idCobro,
                idPersona,
                idUsuario,
                idMoneda,
                idSucursal,
                idComprobante,
                comprobante[0].serie,
                numeracion,
                estado,
                observacion,
                currentDate(),
                currentTime(),
            ]);

            /**
             * Proceso para ingresar el detalle del cobro.
             */

            // Generar el Id único
            const listaCobroDetalle = await conec.execute(connection, 'SELECT idCobroDetalle FROM cobroDetalle');
            let idCobroDetalle = generateNumericCode(1, listaCobroDetalle, 'idCobroDetalle');

            // Proceso de registro  
            await await conec.execute(connection, `INSERT INTO cobroDetalle(
                    idCobroDetalle,
                    idCobro,
                    idConcepto,
                    cantidad,
                    monto
                ) VALUES(?,?,?,?,?)`, [
                idCobroDetalle,
                idCobro,
                idConcepto,
                1,
                monto,
            ])

            /**
             * Proceso para registrar la lista de ingresos con sus método de pagos
             */

            const listaTransaccion = await conec.execute(connection, 'SELECT idTransaccion FROM transaccion');
            let idTransaccion = generateAlphanumericCode('TC0001', listaTransaccion, 'idTransaccion');

            await conec.execute(connection, `
                    INSERT INTO transaccion(
                        idTransaccion,
                        idConcepto,
                        idReferencia,
                        nota,
                        estado,
                        fecha,
                        hora,
                        idUsuario
                    ) VALUES(?,?,?,?,?,?,?,?)`, [
                idTransaccion,
                idConcepto,
                idCobro,
                notaTransacion,
                1,
                currentDate(),
                currentTime(),
                idUsuario
            ]);

            const listaTransaccionDetalle = await conec.execute(connection, 'SELECT idTransaccionDetalle FROM transaccionDetalle');
            let idTransaccionDetalle = generateNumericCode(1, listaTransaccionDetalle, 'idTransaccionDetalle');

            for (const item of bancosAgregados) {
                await conec.execute(connection, `
                    INSERT INTO transaccionDetalle(
                        idTransaccionDetalle,
                        idTransaccion,
                        idBanco,
                        monto,
                        observacion
                    ) VALUES(?,?,?,?,?)`, [
                    idTransaccionDetalle,
                    idTransaccion,
                    item.idBanco,
                    item.monto,
                    item.observacion
                ]);

                idTransaccionDetalle++;
            }

            await conec.commit(connection);
            return sendSave(res, "Se completo el proceso correctamente.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/list", error);
        }
    }

    async detail(req, res) {
        try {
            const cobro = await conec.query(`
            SELECT 
                c.idCobro,
                co.nombre AS comprobante,
                c.serie,
                c.numeracion,
                DATE_FORMAT(c.fecha,'%d/%m/%Y') AS fecha,
                c.hora,
                c.observacion,
                cn.documento,
                cn.informacion,
                c.estado,
                m.codiso,
                u.apellidos,
                u.nombres
            FROM 
                cobro AS c
            INNER JOIN 
                persona AS cn on cn.idPersona = c.idPersona
            INNER JOIN 
                comprobante AS co on co.idComprobante = c.idComprobante
            INNER JOIN 
                moneda AS m on m.idMoneda = c.idMoneda
            INNER JOIN 
                usuario AS u ON u.idUsuario = c.idUsuario
            WHERE 
                c.idCobro = ?`, [
                req.query.idCobro
            ]);

            const detalles = await conec.query(`
            SELECT 
                cp.nombre,
                cb.cantidad,
                cb.monto
            FROM 
                cobroDetalle as cb
            INNER JOIN 
                concepto as cp on cp.idConcepto = cb.idConcepto
            WHERE 
                cb.idCobro = ?`, [
                req.query.idCobro
            ]);

            const transaccion = await conec.query(`
                SELECT 
                t.idTransaccion,
                DATE_FORMAT(t.fecha,'%d/%m/%Y') AS fecha,
                t.hora,
                c.nombre AS concepto,
                t.nota,
                CONCAT(us.nombres,' ',us.apellidos) AS usuario
            FROM 
                transaccion t            
            INNER JOIN
                concepto c ON c.idConcepto = t.idConcepto
            INNER JOIN 
                usuario AS us ON us.idUsuario = t.idUsuario 
            WHERE 
                t.idReferencia = ?`, [
                req.query.idCobro
            ]);

            for (const item of transaccion) {
                const transacciones = await conec.query(`
                    SELECT 
                        b.nombre,
                        td.monto,
                        td.observacion
                    FROM
                        transaccionDetalle td
                    INNER JOIN 
                        banco b on td.idBanco = b.idBanco     
                    WHERE 
                        td.idTransaccion = ?`, [
                    item.idTransaccion
                ]);

                item.detalles = transacciones;
            }

            return sendSuccess(res, { "cabecera": cobro[0], "detalles": detalles, transaccion });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/list", error);
        }
    }

    async cancel(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const exists = await conec.execute(connection, `
            SELECT 
                estado 
            FROM 
                cobro 
            WHERE 
                idCobro = ? AND estado = 0`, [
                req.query.idCobro
            ]);

            if (exists.length !== 0) {
                await conec.rollback(connection);
                return sendClient(res, "El cobro ya se encuentra anulado.");
            }

            await conec.execute(connection, `
            UPDATE 
                cobro 
            SET 
                estado = 0 
            WHERE 
                idCobro = ?`, [
                req.query.idCobro
            ]);

            await conec.execute(connection, `
            UPDATE 
                transaccion 
            SET 
                estado = 0 
            WHERE 
                idReferencia = ?`, [
                req.query.idCobro
            ]);

            await conec.commit(connection);
            return sendSave(res, "Se anuló correctamente el cobro.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/list", error);
        }
    }

}

module.exports = new Cobro();