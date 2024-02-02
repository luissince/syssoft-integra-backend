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
                ? = 0
                OR
                ? = 1 AND c.nombre LIKE CONCAT(?,'%')
                OR
                ? = 1 AND c.serie LIKE CONCAT(?,'%')
                OR
                ? = 1 AND c.numeracion LIKE CONCAT(?,'%')
                LIMIT ?,?`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar,

                parseInt(req.query.opcion),
                req.query.buscar,

                parseInt(req.query.opcion),
                req.query.buscar,

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);


            let resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina),
                };
            });

            let total = await conec.query(`SELECT COUNT(*) AS Total 
            FROM comprobante AS c
            INNER JOIN tipoComprobante AS tc on c.idTipoComprobante = tc.idTipoComprobante
            WHERE 
            ? = 0
            OR
            ? = 1 AND c.nombre LIKE CONCAT(?,'%')
            OR
            ? = 1 AND c.serie LIKE CONCAT(?,'%')
            OR
            ? = 1 AND c.numeracion LIKE CONCAT(?,'%')`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar,

                parseInt(req.query.opcion),
                req.query.buscar,

                parseInt(req.query.opcion),
                req.query.buscar,
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

            const result = await conec.execute(connection, 'SELECT idComprobante FROM comprobante');
            const idComprobante = generateAlphanumericCode("CB0001", result, 'idComprobante');

            await conec.execute(connection, `INSERT INTO comprobante(
            idComprobante,
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
            fecha,
            hora,
            fupdate,
            hupdate,
            idUsuario) 
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idComprobante,
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
            let result = await conec.query(`SELECT * FROM comprobante WHERE idComprobante = ?`, [
                req.query.idComprobante
            ]);
            if (result.length > 0) {
                return sendSuccess(res, result[0])
            } else {
                return sendClient(res, "Datos incorrectos, intente nuevamente.");
            }
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async edit(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const venta = await conec.execute(connection, `SELECT  * FROM venta WHERE idComprobante = ?`, [
                req.body.idComprobante
            ]);

            if (venta.length > 0) {
                await conec.execute(connection, `UPDATE comprobante SET 
                idTipoComprobante = ?,
                nombre = ?,
                impresion = ?,
                codigo = ?,
                estado = ?,
                preferida = ?,
                numeroCampo = ?,
                facturado = ?,
                fupdate = ?,
                hupdate = ?,
                idUsuario = ?
                WHERE idComprobante = ?`, [
                    req.body.idTipoComprobante,
                    req.body.nombre,
                    req.body.impresion,
                    req.body.codigo,
                    req.body.estado,
                    req.body.preferida,
                    req.body.numeroCampo,
                    req.body.facturado,
                    currentDate(),
                    currentTime(),
                    req.body.idUsuario,
                    req.body.idComprobante
                ]);

                await conec.commit(connection);
                sendSuccess(res, "Se actualizó correctamente el comprobante. !Hay campos que no se van editar ya que el comprobante esta ligado a un venta¡");
            } else {
                await conec.execute(connection, `UPDATE comprobante SET 
                idTipoComprobante = ?,
                nombre = ?,
                serie = ?,
                numeracion = ?,
                impresion = ?,
                estado = ?,
                preferida = ?,
                numeroCampo = ?,
                fupdate = ?,
                hupdate = ?,
                idUsuario = ?
                WHERE idComprobante = ?`, [
                    req.body.idTipoComprobante,
                    req.body.nombre,
                    req.body.serie,
                    req.body.numeracion,
                    req.body.impresion,
                    req.body.estado,
                    req.body.preferida,
                    req.body.numeroCampo,
                    currentDate(),
                    currentTime(),
                    req.body.idUsuario,
                    req.body.idComprobante
                ]);

                await conec.commit(connection);
                return sendSuccess(res, "Se actualizó correctamente el comprobante.");
            }
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

            let estado = req.query.estado == undefined ? "" : req.query.estado;

            let result = await conec.query(`SELECT 
            idComprobante, 
            nombre, 
            serie,
            estado, 
            preferida,
            numeroCampo
            FROM comprobante
            WHERE 
            idTipoComprobante = ? AND estado = 1 AND ? = ''
            OR
            idTipoComprobante = ? AND ? = 'all'
            `, [
                req.query.tipo,
                estado,

                req.query.tipo,
                estado,
            ]);
            return sendSuccess(res, result);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.")
        }
    }

}

module.exports = new Comprobante();