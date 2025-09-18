const { currentDate, currentTime, generateAlphanumericCode } = require('../tools/Tools');
const conec = require('../database/mysql-connection');
const { sendClient, sendSave, sendError, sendSuccess } = require('../tools/Message');

class Banco {

    async list(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Bancos(?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_Bancos_Count(?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Banco/list", error);
        }
    }

    async add(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const result = await conec.execute(connection, 'SELECT idBanco FROM banco');
            const idBanco = generateAlphanumericCode("BC0001", result, 'idBanco');

            await conec.execute(connection, `
            INSERT INTO banco(
                idBanco,
                nombre,
                tipoCuenta,
                idMoneda,
                numCuenta,
                idSucursal,
                cci, 
                preferido,
                vuelto,
                reporte,
                compartir,
                estado,
                fecha,
                hora,
                fupdate,
                hupdate,
                idUsuario
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idBanco,
                req.body.nombre,
                req.body.tipoCuenta,
                req.body.idMoneda,
                req.body.numCuenta,
                req.body.idSucursal,
                req.body.cci,
                req.body.preferido,
                req.body.vuelto,
                req.body.reporte,
                req.body.compartir,
                req.body.estado,
                currentDate(),
                currentTime(),
                currentDate(),
                currentTime(),
                req.body.idUsuario
            ]);

            await conec.commit(connection);
            return sendSave(res, "Se registró correctamente el banco.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Banco/add", error);
        }
    }

    async id(req, res) {
        try {
            const result = await conec.query(`
            SELECT 
                * 
            FROM 
                banco 
            WHERE 
                idBanco = ?`, [
                req.query.idBanco,
            ]);

            if (result.length === 0) {
                return sendClient(res, "Información no encontrada.")
            }

            return sendSuccess(res, result[0]);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Banco/id", error);
        }
    }

    async update(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();
            await conec.execute(connection, `
            UPDATE 
                banco 
            SET 
                nombre=?, 
                tipoCuenta=?, 
                idMoneda=?, 
                numCuenta=?, 
                cci=?, 
                preferido=?,
                vuelto=?,
                reporte=?,
                compartir=?,
                estado=?,
                fupdate=?,
                hupdate=?,
                idUsuario=?
            WHERE 
                idBanco=?`, [
                req.body.nombre,
                req.body.tipoCuenta,
                req.body.idMoneda,
                req.body.numCuenta,
                req.body.cci,
                req.body.preferido,
                req.body.vuelto,
                req.body.reporte,
                req.body.compartir,
                req.body.estado,
                currentDate(),
                currentTime(),
                req.body.idUsuario,
                req.body.idBanco
            ]);

            await conec.commit(connection);
            return sendSave(res, "Se actualizó correctamente el banco.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Banco/update", error);
        }
    }


    async detail(req, res) {
        try {
            const banco = await conec.query(`
            SELECT 
                ba.nombre,
                ba.tipoCuenta,
                ba.numCuenta,
                ba.cci,
                ba.compartir,
                ba.estado,
                mo.nombre as moneda,
                mo.codiso
            FROM 
                banco as ba
            INNER JOIN 
                moneda as mo ON ba.idMoneda = mo.idMoneda
            WHERE 
                ba.idBanco = ?`, [
                req.query.idBanco,
            ])

            const total = await conec.query(`
            SELECT 
                SUM(IFNULL(
                    (SELECT 
                        SUM(CASE 
                            WHEN co.idTipoConcepto = 'TC0001' THEN td.monto
                            ELSE -td.monto
                        END) AS saldo 
                    FROM 
                        transaccion AS t 
                    INNER JOIN
                        concepto AS co ON co.idConcepto = t.idConcepto
                    INNER JOIN 
                        transaccionDetalle AS td ON td.idTransaccion = t.idTransaccion 
                    WHERE 
                        td.idBanco = b.idBanco AND t.estado = 1
                    ), 
                0)) AS monto
            FROM 
                banco AS b
            WHERE
                b.idBanco = ?`, [
                req.query.idBanco,
            ])

            return sendSave(res, {
                "banco": banco[0],
                "monto": total[0].monto
            });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Banco/detail", error);
        }
    }

    async delete(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const transaccion = await conec.execute(connection, `
                SELECT 
                    * 
                FROM 
                    transaccionDetalle 
                WHERE 
                    idBanco = ?`, [
                req.query.idBanco
            ]);

            if (transaccion.length !== 0) {
                return sendClient(res, "No se puede eliminar el banco porque tiene una transacción asociada.");
            }

            await conec.execute(connection, `
                UPDATE  
                    banco
                SET
                    estado = -1
                 WHERE 
                    idBanco = ?`, [
                req.query.idBanco
            ]);

            await conec.commit(connection);
            return sendSave(res, "Se eliminó correctamente el banco.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }

            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Banco/delete", error);
        }
    }

    async combo(req, res) {
        try {
            const result = await conec.query(`
            SELECT 
                idBanco, 
                nombre, 
                preferido,
                vuelto 
            FROM 
                banco   
            WHERE 
                estado = 1 AND 
                (
                    (compartir = 1) 
                    OR
                    (compartir = 0 AND idSucursal = ?)
                )`,[
                    req.params.idSucursal
                ]);
            return sendSuccess(res, result);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Banco/combo", error);
        }
    }

    async detailList(req, res) {
        try {
            const lista = await conec.query(`
            SELECT 
                t.idTransaccion,
                DATE_FORMAT(t.fecha, '%d/%m/%Y') AS fecha, 
                t.hora,
                t.estado,
                co.nombre AS concepto,
                CASE 
                    WHEN t.idReferencia = v.idVenta THEN v.idVenta
                    WHEN t.idReferencia = c.idCobro THEN c.idCobro
                    WHEN t.idReferencia = cp.idCompra THEN cp.idCompra
                    ELSE g.idGasto
                END AS idComprobante,
                CASE 
                    WHEN t.idReferencia = v.idVenta THEN cov.nombre
                    WHEN t.idReferencia = c.idCobro THEN coc.nombre
                    WHEN t.idReferencia = cp.idCompra THEN cop.nombre
                    ELSE cog.nombre
                END AS comprobante,
                CASE 
                    WHEN t.idReferencia = v.idVenta THEN 'venta'
                    WHEN t.idReferencia = c.idCobro THEN 'cobro'
                    WHEN t.idReferencia = cp.idCompra THEN 'compra'
                    ELSE 'gasto'
                END AS tipo,
                CASE 
                    WHEN t.idReferencia = v.idVenta THEN v.serie
                    WHEN t.idReferencia = c.idCobro THEN c.serie
                    WHEN t.idReferencia = cp.idCompra THEN cp.serie
                    ELSE g.serie
                END AS serie,
                CASE 
                    WHEN t.idReferencia = v.idVenta THEN v.numeracion
                    WHEN t.idReferencia = c.idCobro THEN c.numeracion
                    WHEN t.idReferencia = cp.idCompra THEN cp.numeracion
                    ELSE g.numeracion
                END AS numeracion,
                CASE 
                    WHEN t.idReferencia = v.idVenta THEN mv.codiso
                    WHEN t.idReferencia = c.idCobro THEN mc.codiso
                    WHEN t.idReferencia = cp.idCompra THEN mcp.codiso
                    ELSE mcg.codiso
                END AS codiso,
                SUM(CASE 
                    WHEN co.idTipoConcepto = 'TC0001' AND t.estado = 1 THEN td.monto 
                    ELSE 0 
                END) AS ingreso,
                SUM(CASE 
                    WHEN co.idTipoConcepto = 'TC0002' AND t.estado = 1 THEN td.monto 
                    ELSE 0 
                END) AS egreso
            FROM
                transaccion AS t
            INNER JOIN
                concepto AS co ON co.idConcepto = t.idConcepto
            LEFT JOIN
                venta AS v ON v.idVenta = t.idReferencia
            LEFT JOIN
                comprobante AS cov ON cov.idComprobante = v.idComprobante
            LEFT JOIN
                moneda AS mv ON mv.idMoneda = v.idMoneda
            LEFT JOIN
                cobro AS c ON c.idCobro = t.idReferencia
            LEFT JOIN
                comprobante AS coc ON coc.idComprobante = c.idComprobante
            LEFT JOIN
                moneda AS mc ON mc.idMoneda = c.idMoneda
            LEFT JOIN
                compra AS cp ON cp.idCompra = t.idReferencia
            LEFT JOIN
                comprobante AS cop ON cop.idComprobante = cp.idComprobante
            LEFT JOIN
                moneda AS mcp ON mcp.idMoneda = cp.idMoneda
            LEFT JOIN
                gasto AS g ON g.idGasto = t.idReferencia
            LEFT JOIN
                comprobante AS cog ON cog.idComprobante = g.idComprobante
            LEFT JOIN
                moneda AS mcg ON mcg.idMoneda = g.idMoneda
            INNER JOIN
                transaccionDetalle AS td ON t.idTransaccion = td.idTransaccion
            INNER JOIN
                banco AS b ON b.idBanco = td.idBanco
            WHERE
                b.idBanco = ?
            GROUP BY
                t.idTransaccion
            ORDER BY
                t.fecha DESC, t.hora DESC
            LIMIT 
                ?, ?`, [
                req.query.idBanco,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.query(`
            SELECT 
                COUNT(DISTINCT t.idTransaccion) AS Total
            FROM
                transaccion AS t
            INNER JOIN
                concepto AS co ON co.idConcepto = t.idConcepto
            INNER JOIN
                transaccionDetalle AS td ON t.idTransaccion = td.idTransaccion
            INNER JOIN
                banco AS b ON b.idBanco = td.idBanco
            WHERE
                b.idBanco = ?`, [
                req.query.idBanco
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Banco/defailtList", error);
        }
    }

}

module.exports = Banco;