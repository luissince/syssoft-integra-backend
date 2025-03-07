const { currentDate, currentTime, generateAlphanumericCode } = require('../tools/Tools');
const { sendSuccess, sendError, sendClient } = require('../tools/Message');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Concepto {

    async list(req, res) {
        try {
            const lista = await conec.query(`
                SELECT 
                    idConcepto,
                    idTipoConcepto,
                    nombre,
                    sistema,
                    DATE_FORMAT(fecha,'%d/%m/%Y') as fecha,
                    hora 
                FROM 
                    concepto
                WHERE 
                    (? = 0)
                    OR
                    (? = 1 AND nombre LIKE concat(?,'%'))
                LIMIT 
                    ?,?`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar,

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

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
                    concepto
                WHERE 
                    (? = 0)
                    OR
                    (? = 1 AND nombre LIKE concat(?,'%'))`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar
            ]);


            return sendSuccess(res, { "result": resultLista, "total": total[0].Total })
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Concepto/list", error);
        }
    }

    async add(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const listConceptos = await conec.execute(connection, 'SELECT idConcepto FROM concepto');
            const idConcepto = generateAlphanumericCode("CP0001", listConceptos, 'idConcepto');

            await conec.execute(connection, `
            INSERT INTO concepto(
                idConcepto, 
                idTipoConcepto,
                nombre, 
                codigo,
                sistema,
                fecha, 
                hora,
                fupdate,
                hupdate,
                idUsuario
            ) VALUES(?,?,?,?,?,?,?,?,?,?)`, [
                idConcepto,
                req.body.idTipoConcepto,
                req.body.nombre,
                req.body.codigo,
                0,
                currentDate(),
                currentTime(),
                currentDate(),
                currentTime(),
                req.body.idUsuario
            ])

            await conec.commit(connection);
            return sendSuccess(res, "Se registró correctamente el concepto.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Concepto/add", error);
        }
    }

    async id(req, res) {
        try {
            const result = await conec.query('SELECT * FROM concepto WHERE idConcepto  = ?', [
                req.query.idConcepto
            ]);

            if (result.length > 0) {
                return sendSuccess(res, result[0]);
            } else {
                return sendClient(res, 'Datos no encontados.');
            }
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Concepto/id", error);
        }
    }

    async update(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            await conec.execute(connection, `
            UPDATE 
                concepto 
            SET 
                idTipoConcepto = ?,
                nombre = ?, 
                codigo = ?,
                fupdate = ?,
                hupdate = ?,
                idUsuario = ?
            WHERE 
                idConcepto=?`, [
                req.body.idTipoConcepto,
                req.body.nombre,
                req.body.codigo,
                currentDate(),
                currentTime(),
                req.body.idUsuario,
                req.body.idConcepto,
            ])

            await conec.commit(connection)
            return sendSuccess(res, 'Se actualizó correctamente el concepto.');
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Concepto/update", error);
        }
    }

    async delete(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const sistem = await conec.execute(connection, `SELECT * FROM concepto WHERE idConcepto = ? AND sistema = 1`, [
                req.query.idConcepto
            ]);

            if (sistem.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'El concepto es del propio sistema, puede ser eliminado.');
            }

            const transaccion = await conec.execute(connection, `SELECT * FROM transaccion WHERE idConcepto = ?`, [
                req.query.idConcepto
            ]);

            if (transaccion.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'El concepto esta relacionado con transacciones, puede ser eliminado.');
            }

            await conec.execute(connection, `DELETE FROM concepto WHERE idConcepto = ?`, [
                req.query.idConcepto
            ]);

            await conec.commit(connection)
            return sendSuccess(res, 'Se eliminó correctamente el concepto.');
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Concepto/delete", error);
        }
    }

    async filtrarCobro(req, res) {
        try {
            const result = await conec.query(`
            SELECT 
                idConcepto, 
                nombre 
            FROM 
                concepto 
            WHERE 
                idTipoConcepto = 'TC0001' AND nombre LIKE concat(?,'%') AND sistema <> 1`, [
                req.query.filtrar,
            ]);
            return sendSuccess(res, result);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Concepto/filtrarCobro", error);
        }
    }

    async filtrarGasto(req, res) {
        try {
            const result = await conec.query(`
            SELECT 
                idConcepto, 
                nombre 
            FROM 
                concepto 
            WHERE 
                idTipoConcepto = 'TC0002' AND nombre LIKE concat(?,'%') AND sistema <> 1`, [
                req.query.filtrar,
            ]);
            return sendSuccess(res, result);;
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Concepto/filtrarGasto", error);
        }
    }
}

module.exports = new Concepto();