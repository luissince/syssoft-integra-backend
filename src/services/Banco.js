const { currentDate, currentTime, generateAlphanumericCode } = require('../tools/Tools');
const Conexion = require('../database/Conexion');
const { sendClient, sendSave, sendError, sendSuccess } = require('../tools/Message');
const conec = new Conexion();

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
                estado,
                fecha,
                hora,
                fupdate,
                hupdate,
                idUsuario
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
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
                IFNULL(SUM(CASE 
                WHEN tipo = 1 THEN monto
                ELSE  -monto
            END),0) AS monto 
            FROM 
                bancoDetalle
            WHERE 
                idBanco = ? AND estado = 1`, [
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

            const detalles = await conec.execute(connection, `
            SELECT 
                idBanco
            FROM 
                bancoDetalle 
            WHERE 
                idBanco = ?`, [
                req.query.idBanco
            ]);

            if (detalles.length !== 0) {
                return sendClient(res, "No se puedo borrar el banco porque, tiene ligado una lista de ingresos.")
            }

            await conec.execute(connection, `DELETE FROM banco WHERE idBanco = ?`, [
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
                estado = 1 AND idSucursal = ?`,[
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
                DATE_FORMAT(bd.fecha, '%d/%m/%Y') AS fecha, 
                bd.hora,
                bd.tipo,
                --
                CASE 
                    WHEN i.idIngreso IS NOT NULL THEN  
                        CASE 
                            WHEN vt.idVenta is not null THEN  'venta'
                            ELSE 'cobro'
                        END
                    ELSE 
                        CASE 
                            WHEN cm.idCompra is not null THEN  'compra'
                            ELSE 'gasto'
                        END
                END AS opcion,
                --
                CASE 
                    WHEN i.idIngreso IS NOT NULL THEN  
                        IFNULL(vt.idVenta, co.idCobro)
                    ELSE 
                        IFNULL(cm.idCompra, gt.idGasto)
                END AS idComprobante,             
                --
                CASE 
                    WHEN i.idIngreso IS NOT NULL THEN  
                        IFNULL(cov.nombre, coc.nombre)
                    ELSE 
                        IFNULL(com.nombre, cog.nombre)
                END AS comprobante,
                --
                CASE 
                    WHEN i.idIngreso IS NOT NULL THEN  
                        IFNULL(vt.serie, co.serie)
                    ELSE 
                        IFNULL(cm.serie, gt.serie)
                END AS serie,
                --
                CASE 
                    WHEN i.idIngreso IS NOT NULL THEN  
                        IFNULL(vt.numeracion, co.numeracion)
                    ELSE 
                        IFNULL(cm.numeracion, gt.numeracion)
                END AS numeracion,
                --
                bd.estado,
                bd.monto
            FROM 
                bancoDetalle AS bd
            LEFT JOIN
                ingreso AS i ON i.idBancoDetalle = bd.idBancoDetalle
            LEFT JOIN
                venta AS vt ON vt.idVenta = i.idVenta
            LEFT JOIN
                comprobante AS cov ON cov.idComprobante = vt.idComprobante
            LEFT JOIN
                cobro AS co ON co.idCobro = i.idCobro
            LEFT JOIN
                comprobante AS coc ON coc.idComprobante = co.idComprobante
                
            LEFT JOIN 
                salida AS s ON s.idBancoDetalle = bd.idBancoDetalle
            LEFT JOIN
                compra AS cm ON s.idCompra = cm.idCompra
            LEFT JOIN
                comprobante AS com ON com.idComprobante = cm.idComprobante
            LEFT JOIN
                gasto AS gt ON s.idGasto = gt.idGasto
            LEFT JOIN
                comprobante AS cog ON cog.idComprobante = gt.idComprobante
            WHERE
                bd.idBanco = ?
            ORDER BY 
                bd.fecha DESC, 
                bd.hora DESC
            LIMIT ?,?`, [
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
                COUNT(*) AS Total
            FROM 
                bancoDetalle AS bd
            LEFT JOIN
                ingreso AS i ON i.idBancoDetalle = bd.idBancoDetalle
            LEFT JOIN
                venta AS vt ON vt.idVenta = i.idVenta
            LEFT JOIN
                comprobante AS cov ON cov.idComprobante = vt.idComprobante
            LEFT JOIN
                cobro AS co ON co.idCobro = i.idCobro
            LEFT JOIN
                comprobante AS coc ON coc.idComprobante = co.idComprobante
            LEFT JOIN 
                salida AS s ON s.idBancoDetalle = bd.idBancoDetalle
            LEFT JOIN
                compra AS cm ON s.idCompra = cm.idCompra
            LEFT JOIN
                comprobante AS com ON com.idComprobante = cm.idComprobante
            LEFT JOIN
                gasto AS gt ON s.idGasto = gt.idGasto
            LEFT JOIN
                comprobante AS cog ON cog.idComprobante = gt.idComprobante
            WHERE 
                bd.idBanco = ?`, [
                req.query.idBanco
            ])

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Banco/defailtList", error);
        }
    }

}

module.exports = Banco;