const conec = require('../database/mysql-connection');
const { currentDate, currentTime, generateAlphanumericCode } = require('../tools/Tools');
const { sendSuccess, sendClient, sendError, sendSave, sendNotFound } = require('../tools/Message');

class Cargo {

    async list(req, res) {
        try {
            const lista = await conec.query(`SELECT 
                idCargo, 
                nombre,
                descripcion,
                estado,
                fecha,
                hora,
                idUsuario
                FROM cargo 
                WHERE 
                ? = 0
                OR
                ? = 1 AND (nombre like concat(?,'%') )

                LIMIT ?,?`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar,

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

            let resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.query(`SELECT COUNT(*) AS Total 
                FROM cargo  
                WHERE 
                ? = 0
                OR
                ? = 1 AND (nombre like concat(?,'%'))`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.buscar,
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cargo/list", error);
        }
    }

    async id(req, res) {
        try {
            const result = await conec.query(`
          SELECT
            idCargo,
            nombre,
            descripcion,
            estado,
            fecha,
            hora,
            idUsuario
          FROM 
            cargo 
          WHERE 
            idCargo = ?`, [
                req.params.idCargo
            ]);

            return sendSuccess(res, result[0]);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cargo/id", error);
        }
    }

    async add(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const result = await conec.execute(connection, 'SELECT idCargo FROM cargo');
            const idCargo = generateAlphanumericCode("CR0001", result, 'idCargo');

            await conec.execute(connection, `INSERT INTO cargo(
                idCargo,
                nombre,
                descripcion,
                estado,
                fecha,
                hora,
                idUsuario
            ) VALUES (?,?,?,?,?,?,?)`, [
                idCargo,
                req.body.nombre,
                req.body.descripcion,
                req.body.estado,
                currentDate(),
                currentTime(),
                req.body.idUsuario
            ]);

            await conec.commit(connection);
            return sendSave(res, 'Datos insertados correctamente.');
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cargo/add", error);
        }
    }

    async update(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            await conec.execute(connection, `
          UPDATE 
            cargo 
          SET
            nombre = ?,
            descripcion = ?,
            estado = ?,
            fupdate = ?,
            hupdate = ?,
            idUsuario = ?
          WHERE 
            idCargo  = ?`, [
                req.body.nombre,
                req.body.descripcion,
                req.body.estado,
                currentDate(),
                currentTime(),
                req.body.idUsuario,
                req.body.idCargo,
            ]
            );

            await conec.commit(connection);
            return sendSave(res, "Se actualizó correctamente el cargo.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cargo/edit", error);
        }
    }

    async delete(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const empleado = await conec.execute(connection, `SELECT * FROM empleado WHERE idCargo = ?`, [
                req.query.idCargo
            ]);

            if (empleado.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el cargo ya que esta ligado a un empleado.');
            }


            await conec.execute(connection, `DELETE FROM cargo WHERE idCargo  = ?`, [
                req.params.idCargo
            ]);

            await conec.commit(connection)
            return sendSave(res, 'Se eliminó correctamente el cargo.');
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cargo/delete", error);
        }
    }

    async combo(req, res) {
        try {
            const result = await conec.query(`SELECT 
                    idCargo, 
                    nombre
                    FROM cargo`, [])

            return sendSuccess(res, result)
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Cargo/combo", error);
        }
    }
}

module.exports = new Cargo();