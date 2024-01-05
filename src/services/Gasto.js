const { currentDate, currentTime, generateNumericCode, generateAlphanumericCode } = require('../tools/Tools');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Gasto {

    async list(req) {
        try {
            const lista = await conec.procedure(`CALL Listar_Gastos(?,?,?,?,?)`, [
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

            const total = await conec.procedure(`CALL Listar_Gastos_Count(?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal
            ]);

            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {         
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async create(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const {
                idCliente,
                idUsuario,
                idMoneda,
                idSucursal,
                idComprobante,
                estado,
                observacion,
                detalle,
                metodoPago
            } = req.body;          

            /**
            * Generar un código unico para el gasto. 
            */
            const resultCobro = await conec.execute(connection, 'SELECT idGasto FROM gasto');
            const idGasto = generateAlphanumericCode("GT0001", resultCobro, 'idGasto');

            /**
            * Obtener la serie y numeración del comprobante.
            */

            const comprobante = await conec.execute(connection, `SELECT 
                serie,
                numeracion 
                FROM comprobante 
                WHERE idComprobante  = ?
            `, [
                idComprobante
            ]);

            const gastos = await conec.execute(connection, `SELECT 
                numeracion  
                FROM gasto 
                WHERE idComprobante = ?`, [
                idComprobante
            ]);

            const numeracion = generateNumericCode(comprobante[0].numeracion, gastos, "numeracion");

            /**
             * Proceso para ingresar el gasto.
             */

            // Proceso de registro
            await conec.execute(connection, `INSERT INTO gasto(
                idGasto,
                idCliente,
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
                idGasto,
                idCliente,
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
             * Proceso para ingresar el detalle del gasto.
             */

            // Generar el Id único
            const listaGastoDetalle = await conec.execute(connection, 'SELECT idGastoDetalle FROM gastoDetalle');
            let idGastoDetalle = generateNumericCode(1, listaGastoDetalle, 'idGastoDetalle');

            // Proceso de registro  
            for (const item of detalle) {
                await await conec.execute(connection, `INSERT INTO gastoDetalle(
                    idGastoDetalle,
                    idGasto,
                    idConcepto,
                    cantidad,
                    precio
                ) VALUES(?,?,?,?,?)`, [
                    idGastoDetalle,
                    idGasto,
                    item.idConcepto,
                    item.cantidad,
                    item.precio,
                ])

                idGastoDetalle++;
            }

            /**
             * Proceso para registrar la lista de salidas con sus método de pagos
             */
            // Generar el Id único
            const listaSalidasId = await conec.execute(connection, 'SELECT idSalida FROM salida');
            let idSalida = generateNumericCode(1, listaSalidasId, 'idSalida');

            // Proceso de registro  
            for (const item of metodoPago) {
                await conec.execute(connection, `INSERT INTO salida(
                    idSalida,
                    idCompra,
                    idGasto,
                    idMetodoPago,
                    monto,
                    descripcion,
                    estado,
                    fecha,
                    hora,
                    idUsuario
                ) VALUES(?,?,?,?,?,?,?,?,?,?)`, [
                    idSalida,
                    null,
                    idGasto,
                    item.idMetodoPago,
                    item.monto,
                    item.descripcion,
                    1,
                    currentDate(),
                    currentTime(),
                    idUsuario
                ])

                idSalida++;
            }

            /**
             * Proceso de registrar datos en la tabla auditoria para tener un control de los movimientos echos.
             */

            // Generar el Id único
            const listaAuditoriaId = await conec.execute(connection, 'SELECT idAuditoria FROM auditoria');
            const idAuditoria = generateNumericCode(1, listaAuditoriaId, 'idAuditoria');

            // Proceso de registro            
            await conec.execute(connection, `INSERT INTO auditoria(
                idAuditoria,
                idProcedencia,
                descripcion,
                fecha,
                hora,
                idUsuario) 
                VALUES(?,?,?,?,?,?)`, [
                idAuditoria,
                idGasto,
                `REGSITRO DE GASTO ${comprobante[0].serie}-${numeracion}`,
                currentDate(),
                currentTime(),
                idUsuario
            ]);

            await conec.commit(connection);
            return 'create';
        } catch (error) {        
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async detail(req) {
        try {
            const gasto = await conec.query(`SELECT 
                g.idGasto,
                co.nombre AS comprobante,
                g.serie,
                g.numeracion,
                DATE_FORMAT(g.fecha,'%d/%m/%Y') AS fecha,
                g.hora,
                cn.documento,
                cn.informacion,
                g.estado,
                m.codiso,
                u.apellidos,
                u.nombres
                FROM gasto AS g
                INNER JOIN clienteNatural AS cn on cn.idCliente = g.idCliente
                INNER JOIN comprobante AS co on co.idComprobante = g.idComprobante
                INNER JOIN moneda AS m on m.idMoneda = g.idMoneda
                INNER JOIN usuario AS u ON u.idUsuario = g.idUsuario
                WHERE g.idGasto = ?`, [
                req.query.idGasto
            ])

            const detalle = await conec.query(`SELECT 
                cp.nombre,
                gd.cantidad,
                gd.precio
                FROM gastoDetalle as gd
                INNER JOIN concepto as cp on cp.idConcepto = gd.idConcepto
                WHERE gd.idGasto = ?`, [
                req.query.idGasto
            ])

            const salidas = await conec.query(`SELECT 
                mp.nombre,
                s.descripcion,
                s.monto,
                DATE_FORMAT(s.fecha,'%d/%m/%Y') as fecha,
                s.hora
                from salida as s 
                INNER JOIN gasto AS g ON g.idGasto = s.idGasto
                INNER JOIN metodoPago as mp on mp.idMetodoPago = s.idMetodoPago
                WHERE g.idGasto = ?`, [
                req.query.idGasto
            ])

            return { "cabecera": gasto[0], "detalle": detalle, "salidas": salidas };
        } catch (error) {     
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async cancel(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const exists = await conec.execute(connection, `SELECT estado FROM gasto WHERE idGasto = ? AND estado = 0`, [
                req.query.idGasto
            ]);

            if (exists.length !== 0) {
                await conec.rollback(connection);
                return "El gasto ya se encuentra anulado.";
            }

            await conec.execute(connection, `UPDATE gasto SET estado = 0 WHERE idGasto = ?`, [
                req.query.idGasto
            ])

            await conec.execute(connection, `UPDATE salida SET estado = 0 WHERE idGasto = ?`, [
                req.query.idGasto
            ])

            await conec.commit(connection);
            return "cancel";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

}

module.exports = Gasto;