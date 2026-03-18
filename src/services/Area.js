const conec = require('../database/mysql-connection');
const { currentDate, currentTime, generateAlphanumericCode } = require('../tools/Tools');
const { sendSuccess, sendClient, sendError, sendSave, sendNotFound } = require('../tools/Message');

class Area {

    async list(req, res) {
        try {
            const lista = await conec.query(`SELECT 
                idArea, 
                nombre,
                descripcion,
                estado,
                fecha,
                hora,
                idUsuario
                FROM area 
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
                FROM area  
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Area/list", error);
        }
    }

    async id(req, res) {
        try {
            const result = await conec.query(`
          SELECT
            idArea,
            nombre,
            descripcion,
            estado,
            fecha,
            hora,
            idUsuario
          FROM 
            area 
          WHERE 
            idArea = ?`, [
                req.params.idArea
            ]);

            return sendSuccess(res, result[0]);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Area/id", error);
        }
    }

    async add(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const result = await conec.execute(connection, 'SELECT idArea FROM area');
            const idArea = generateAlphanumericCode("AR0001", result, 'idArea');

            await conec.execute(connection, `INSERT INTO area(
                idArea,
                nombre,
                descripcion,
                estado,
                fecha,
                hora,
                idUsuario
            ) VALUES (?,?,?,?,?,?,?)`, [
                idArea,
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Area/add", error);
        }
    }

    async update(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            await conec.execute(connection, `
          UPDATE 
            area 
          SET
            nombre = ?,
            descripcion = ?,
            estado = ?,
            fupdate = ?,
            hupdate = ?,
            idUsuario = ?
          WHERE 
            idArea  = ?`, [
                req.body.nombre,
                req.body.descripcion,
                req.body.estado,
                currentDate(),
                currentTime(),
                req.body.idUsuario,
                req.body.idArea,
            ]
            );

            await conec.commit(connection);
            return sendSave(res, "Se actualizó correctamente la area.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Area/edit", error);
        }
    }

    async delete(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const empleado = await conec.execute(connection, `SELECT * FROM empleado WHERE idArea = ?`, [
                req.query.idArea
            ]);

            if (empleado.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar la area ya que esta ligada a un empleado.');
            }


            await conec.execute(connection, `DELETE FROM area WHERE idArea  = ?`, [
                req.params.idArea
            ]);

            await conec.commit(connection)
            return sendSave(res, 'Se eliminó correctamente el area.');
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Area/delete", error);
        }
    }

    async combo(req, res) {
        try {
            const result = await conec.query(`SELECT 
                idArea, 
                nombre
                FROM area`, [])

            console.log("area combo")
            console.log(result);

            return sendSuccess(res, result)
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Area/combo", error);
        }
    }
}

module.exports = new Area();