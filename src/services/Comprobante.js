const { currentDate, currentTime, generateAlphanumericCode } = require('../tools/Tools');
const { sendSuccess, sendError, sendClient } = require('../tools/Message');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Comprobante {

    async list(req, res) {
        try {

            let lista = await conec.query(`SELECT 
                c.idComprobante,
                tc.nombre 'tipo',
                c.nombre,
                c.serie, 
                c.numeracion,
                c.impresion,
                c.estado, 
                c.preferida
                FROM comprobante AS c
                INNER JOIN tipoComprobante AS tc on c.idTipoComprobante = tc.idTipoComprobante
                WHERE 
                ? = 0 AND c.idSucursal = ?
                OR
                ? = 1 AND c.nombre LIKE CONCAT(?,'%') AND c.idSucursal = ? 
                OR
                ? = 1 AND c.serie LIKE CONCAT(?,'%') AND c.idSucursal = ?
                OR
                ? = 1 AND c.numeracion LIKE CONCAT(?,'%') AND c.idSucursal = ?
                LIMIT ?,?`, [
                parseInt(req.query.opcion),
                req.query.idSucursal,

                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,

                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,

                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);


            let resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina),
                };
            });

            let total = await conec.query(`
            SELECT 
                COUNT(*) AS Total 
            FROM 
                comprobante AS c
            INNER JOIN 
                tipoComprobante AS tc on c.idTipoComprobante = tc.idTipoComprobante
            WHERE 
                ? = 0
                OR
                ? = 1 AND c.nombre LIKE CONCAT(?,'%') AND c.idSucursal = ?
                OR
                ? = 1 AND c.serie LIKE CONCAT(?,'%') AND c.idSucursal = ?
                OR
                ? = 1 AND c.numeracion LIKE CONCAT(?,'%') AND c.idSucursal = ?`, [
                parseInt(req.query.opcion),
                req.query.idSucursal,

                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,

                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,

                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total })
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.")
        }
    }

    async add(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            if (req.body.preferida) {
                await conec.execute(connection, `
                UPDATE 
                    comprobante 
                SET 
                    preferida = 0 
                WHERE 
                    idTipoComprobante = ? AND idSucursal = ?`, [
                    req.body.idTipoComprobante,
                    req.body.idSucursal,
                ]);
            }

            const result = await conec.execute(connection, 'SELECT idComprobante FROM comprobante');
            const idComprobante = generateAlphanumericCode("CB0001", result, 'idComprobante');

            await conec.execute(connection, `INSERT INTO comprobante(
                idComprobante,
                idSucursal,
                idTipoComprobante,
                nombre,
                serie,
                numeracion,
                codigo,
                impresion,
                estado,
                preferida,
                numeroCampo,
                facturado,
                anulacion,
                fecha,
                hora,
                fupdate,
                hupdate,
                idUsuario
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idComprobante,
                req.body.idSucursal,
                req.body.idTipoComprobante,
                req.body.nombre,
                req.body.serie,
                req.body.numeracion,
                req.body.codigo,
                req.body.impresion,
                req.body.estado,
                req.body.preferida,
                req.body.numeroCampo,
                req.body.facturado,
                req.body.anulacion,
                currentDate(),
                currentTime(),
                currentDate(),
                currentTime(),
                req.body.idUsuario,
            ]);

            const comprobante = await conec.execute(connection, `SELECT * FROM comprobante WHERE idTipoComprobante = ?`, [
                req.body.idTipoComprobante,
            ]);

            if (comprobante.length === 0) {
                await conec.execute(connection, `UPDATE comprobante SET preferida = 1 WHERE idComprobante = ?`, [
                    idComprobante
                ]);
            }

            await conec.commit(connection);
            return sendSuccess(res, "Se inserto correctamente el comprobante.")
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async id(req, res) {
        try {
            const result = await conec.query(`SELECT * FROM comprobante WHERE idComprobante = ?`, [
                req.query.idComprobante
            ]);

            return sendSuccess(res, result[0])
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async edit(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            if (req.body.preferida) {
                await conec.execute(connection, `
                UPDATE 
                    comprobante 
                SET 
                    preferida = 0 
                WHERE 
                    idTipoComprobante = ? AND idSucursal = ?`, [
                    req.body.idTipoComprobante,
                    req.body.idSucursal,
                ]);
            }

            await conec.execute(connection, `
            UPDATE 
                comprobante 
            SET 
                idTipoComprobante = ?,
                nombre = ?,
                serie = ?,
                numeracion = ?,
                codigo = ?,
                impresion = ?,                
                estado = ?,
                preferida = ?,
                numeroCampo = ?,
                facturado = ?,                
                anulacion = ?,
                fupdate = ?,
                hupdate = ?,
                idUsuario = ?
            WHERE 
                idComprobante = ?`, [
                req.body.idTipoComprobante,
                req.body.nombre,
                req.body.serie,
                req.body.numeracion,
                req.body.codigo,
                req.body.impresion,
                req.body.estado,
                req.body.preferida,
                req.body.numeroCampo,
                req.body.facturado,
                req.body.anulacion,
                currentDate(),
                currentTime(),
                req.body.idUsuario,
                req.body.idComprobante
            ]);

            await conec.commit(connection);
            return sendSuccess(res, "Se actualizó correctamente el comprobante.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async delete(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const venta = await conec.execute(connection, `SELECT * FROM venta WHERE idComprobante = ?`, [
                req.query.idComprobante
            ]);

            if (venta.length > 0) {
                await conec.rollback(connection);
                sendClient(res, 'No se puede eliminar el comprobante ya que esta ligada a un venta.');
            }

            await conec.execute(connection, `DELETE FROM comprobante WHERE idComprobante = ?`, [
                req.query.idComprobante
            ]);

            await conec.commit(connection)
            return sendSuccess(res, 'Se eliminó correctamente el comprobante.');
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async combo(req, res) {
        try {
            const idTipoComprobante = req.query.tipo;

            const idSucursal = req.query.idSucursal == undefined ? "" : req.query.idSucursal;

            const result = await conec.query(`
            SELECT 
                idComprobante, 
                nombre, 
                serie,
                estado, 
                preferida,
                numeroCampo
            FROM 
                comprobante
            WHERE 
                estado = 1 AND (
                    (idTipoComprobante = ? AND ? = '')
                    OR
                    (idTipoComprobante = ? AND idSucursal = ?)
                )`,
                [
                    idTipoComprobante,
                    idSucursal,

                    idTipoComprobante,
                    idSucursal,
                ]);
            return sendSuccess(res, result);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.")
        }
    }

}

module.exports = new Comprobante();