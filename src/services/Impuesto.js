const conec = require('../database/mysql-connection');
const { currentDate, currentTime, generateAlphanumericCode } = require('../tools/Tools');
const { sendSuccess, sendClient, sendError, sendSave } = require('../tools/Message');

class Impuesto {

    async list(req, res) {
        try {
            const lista = await conec.query(`SELECT 
            idImpuesto,
            nombre,
            porcentaje,
            codigo,
            estado,
            preferido,
            DATE_FORMAT(fecha,'%d/%m/%Y') as fecha, 
            hora
            FROM impuesto
            WHERE 
            ? = 0
            OR
            ? = 1 and nombre like concat(?,'%')
            LIMIT ?,?`, [
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

            const total = await conec.query(`SELECT COUNT(*) AS Total 
            FROM impuesto
            WHERE 
            ? = 0
            OR
            ? = 1 and nombre like concat(?,'%')`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Impuesto/list", error);
        }
    }

    async add(req, res) {
        let connection = null;
        try {

            connection = await conec.beginTransaction();

            // Genera un nuevo ID para la compra
            const resultImpuesto = await conec.execute(connection, 'SELECT idImpuesto FROM impuesto');
            const idImpuesto = generateAlphanumericCode("IM0001", resultImpuesto, 'idImpuesto');

            if (req.body.preferido) {
                await conec.execute(connection, `UPDATE impuesto SET preferido = 0`);
            }

            await conec.execute(connection, `INSERT INTO impuesto(
                idImpuesto, 
                nombre,
                porcentaje,
                codigo,
                estado,
                preferido,
                fecha,
                hora,
                fupdate,
                hupdate,
                idUsuario) 
                VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [
                idImpuesto,
                req.body.nombre,
                req.body.porcentaje,
                req.body.codigo,
                req.body.estado,
                req.body.preferido,
                currentDate(),
                currentTime(),
                currentDate(),
                currentTime(),
                req.body.idUsuario,
            ])

            await conec.commit(connection);
            return sendSave(res, "Los datos se registraron correctamente.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Impuesto/add", error);
        }
    }

    async id(req, res) {
        try {
            let result = await conec.query('SELECT * FROM impuesto WHERE idImpuesto  = ?', [
                req.query.idImpuesto
            ]);

            if (result.length > 0) {
                return sendSuccess(res, result[0]);
            } else {
                return sendClient(res, "Datos no encontrados");
            }

        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Impuesto/id", error);
        }
    }

    async edit(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            if (req.body.preferido) {
                await conec.execute(connection, `UPDATE impuesto SET preferido = 0`);
            }

            await conec.execute(connection, `UPDATE impuesto 
            SET 
                nombre=?,
                porcentaje=?,
                codigo=?,
                estado=?,
                preferido=?,
                idUsuario=?
            WHERE 
                idImpuesto=?`, [
                req.body.nombre,
                req.body.porcentaje,
                req.body.codigo,
                req.body.estado,
                req.body.preferido,
                req.body.idUsuario,
                req.body.idImpuesto
            ])

            await conec.commit(connection)
            return sendSave(res, 'Los datos se actualizarón correctamente.');
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Impuesto/edit", error);
        }
    }

    async delete(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const cobroDetalle = await conec.execute(connection, `SELECT * FROM cobroDetalle WHERE idImpuesto = ?`, [
                req.query.idImpuesto
            ]);

            if (cobroDetalle.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el impuesto ya que esta ligada a un detalle de cobro.');
            }

            const gastoDetalle = await conec.execute(connection, `SELECT * FROM gastoDetalle WHERE idImpuesto = ?`, [
                req.query.idImpuesto
            ]);

            if (gastoDetalle.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el impuesto ya que esta ligada a un detalle de gasto.');
            }

            const ventaDetalle = await conec.execute(connection, `SELECT * FROM ventaDetalle WHERE idImpuesto = ?`, [
                req.query.idImpuesto
            ]);

            if (ventaDetalle.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el impuesto ya que esta ligada a un detalle de venta.');
            }

            const preferido = await conec.execute(connection, `SELECT * FROM impuesto WHERE preferido = 1 AND idImpuesto = ?`,[
                req.query.idImpuesto
            ]);

            if (preferido.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'El impuesto tiene el estado preferido, cambie el valor para poder eliminar.');
            }

            await conec.execute(connection, `DELETE FROM impuesto WHERE idImpuesto   = ?`, [
                req.query.idImpuesto
            ]);

            await conec.commit(connection)
            return sendSave(res, 'Se eliminó correctamente el impuesto.');
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Impuesto/delete", error);
        }
    }

    async combo(req, res) {
        try {
            const result = await conec.query(`SELECT 
                idImpuesto,
                nombre,
                porcentaje,
                preferido 
            FROM 
                impuesto`);
            return sendSuccess(res, result);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.","Impuesto/combo", error);
        }
    }
}

module.exports = new Impuesto();