const { currentDate, currentTime, generateNumericCode, generateAlphanumericCode } = require('../tools/Tools');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Cobro {

    async list(req) {
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
                idPersona,
                idUsuario,
                idMoneda,
                idSucursal,
                idComprobante,
                estado,
                observacion,
                detalle,
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

            const comprobante = await conec.execute(connection, `SELECT 
                serie,
                numeracion 
                FROM comprobante 
                WHERE idComprobante  = ?
            `, [
                idComprobante
            ]);

            const cobros = await conec.execute(connection, `SELECT 
                numeracion  
                FROM cobro 
                WHERE idComprobante = ?`, [
                idComprobante
            ]);

            const numeracion = generateNumericCode(comprobante[0].numeracion, cobros, "numeracion");

            /**
             * Proceso para ingresar el cobro.
             */

            // Proceso de registro
            await conec.execute(connection, `INSERT INTO cobro(
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
            for (const item of detalle) {
                await await conec.execute(connection, `INSERT INTO cobroDetalle(
                    idCobroDetalle,
                    idCobro,
                    idConcepto,
                    cantidad,
                    precio
                ) VALUES(?,?,?,?,?)`, [
                    idCobroDetalle,
                    idCobro,
                    item.idConcepto,
                    item.cantidad,
                    item.precio,
                ])

                idCobroDetalle++;
            }

            /**
             * Proceso para registrar la lista de ingresos con sus método de pagos
             */

            // Generar el Id único
            const listaIngresos = await conec.execute(connection, 'SELECT idIngreso FROM ingreso');
            let idIngreso = generateNumericCode(1, listaIngresos, 'idIngreso');

            const listaBancoDetalle = await conec.execute(connection, 'SELECT idBancoDetalle FROM bancoDetalle');
            let idBancoDetalle = generateNumericCode(1, listaBancoDetalle, 'idBancoDetalle');

            // Proceso de registro  
            for (const item of bancosAgregados) {
                await conec.execute(connection, `INSERT INTO ingreso(
                    idIngreso,
                    idVenta,
                    idCobro,
                    idBancoDetalle,
                    monto,
                    descripcion,
                    estado,
                    fecha,
                    hora,
                    idUsuario
                ) VALUES(?,?,?,?,?,?,?,?,?,?)`, [
                    idIngreso,
                    null,
                    idCobro,
                    idBancoDetalle,
                    item.monto,
                    item.descripcion,
                    1,
                    currentDate(),
                    currentTime(),
                    idUsuario
                ]);

                await conec.execute(connection, `INSERT INTO bancoDetalle(
                    idBancoDetalle,
                    idBanco,
                    tipo,
                    monto,
                    estado,
                    fecha,
                    hora,
                    idUsuario
                ) VALUES(?,?,?,?,?,?,?,?)`, [
                    idBancoDetalle,
                    item.idBanco,
                    1,
                    item.monto,
                    1,
                    currentDate(),
                    currentTime(),
                    idUsuario
                ]);

                idIngreso++;
                idBancoDetalle++;
            }

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
            const cobro = await conec.query(`SELECT 
                c.idCobro,
                co.nombre AS comprobante,
                c.serie,
                c.numeracion,
                DATE_FORMAT(c.fecha,'%d/%m/%Y') AS fecha,
                c.hora,
                cn.documento,
                cn.informacion,
                c.estado,
                m.codiso,
                u.apellidos,
                u.nombres
                FROM cobro AS c
                INNER JOIN persona AS cn on cn.idPersona = c.idPersona
                INNER JOIN comprobante AS co on co.idComprobante = c.idComprobante
                INNER JOIN moneda AS m on m.idMoneda = c.idMoneda
                INNER JOIN usuario AS u ON u.idUsuario = c.idUsuario
                WHERE c.idCobro = ?`, [
                req.query.idCobro
            ])

            const detalle = await conec.query(`SELECT 
                cp.nombre,
                cb.cantidad,
                cb.precio
                FROM cobroDetalle as cb
                INNER JOIN concepto as cp on cp.idConcepto = cb.idConcepto
                WHERE cb.idCobro = ?`, [
                req.query.idCobro
            ])

            const ingresos = await conec.query(`
            SELECT 
                mp.nombre,
                i.descripcion,
                i.monto,
                DATE_FORMAT(i.fecha,'%d/%m/%Y') as fecha,
                i.hora
            FROM 
                ingreso as i 
            INNER JOIN 
                bancoDetalle AS bd ON bd.idBancoDetalle = i.idBancoDetalle
            INNER JOIN 
                banco as mp on mp.idBanco = bd.idBanco              
            WHERE 
                i.idCobro = ?`, [
                req.query.idCobro
            ])

            return { "cabecera": cobro[0], "detalle": detalle, "ingresos": ingresos };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async cancel(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const exists = await conec.execute(connection, `SELECT estado FROM cobro WHERE idCobro = ? AND estado = 0`, [
                req.query.idCobro
            ]);

            if (exists.length !== 0) {
                await conec.rollback(connection);
                return "El cobro ya se encuentra anulado.";
            }

            await conec.execute(connection, `UPDATE cobro SET estado = 0 WHERE idCobro = ?`, [
                req.query.idCobro
            ])

            const ingresos = await conec.execute(connection, `SELECT idBancoDetalle FROM ingreso WHERE idCobro = ?`, [
                req.query.idCobro
            ])

            for (const item of ingresos) {
                await conec.execute(connection, `UPDATE bancoDetalle 
                SET 
                    estado = 0 
                WHERE 
                    idBancoDetalle = ?`, [
                        item.idBancoDetalle
                ])
            }

            await conec.execute(connection, `UPDATE ingreso SET estado = 0 WHERE idCobro = ?`, [
                req.query.idCobro
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

module.exports = Cobro