const { currentDate, currentTime, generateAlphanumericCode } = require('../tools/Tools');
const conec = require('../database/mysql-connection');
const { sendClient, sendSave, sendError, sendSuccess } = require('../tools/Message');

class Consulta {

    async list(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Consultas(?,?,?,?)`, [
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

            const total = await conec.procedure(`CALL Listar_Consultas_Count(?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Consulta/list", error);
        }
    }

    async add(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const result = await conec.execute(connection, 'SELECT idConsulta FROM consulta');
            const idConsulta = generateAlphanumericCode("CS0001", result, 'idConsulta');

            await conec.execute(connection, `
            INSERT INTO consulta(
                idConsulta,
                nombre,
                email,
                celular,
                asunto,
                mensaje,
                estado, 
                fecha,
                hora
            ) VALUES (?,?,?,?,?,?,?,?,?)`, [
                idConsulta,
                req.body.nombre,
                req.body.email,
                req.body.celular,
                req.body.asunto,
                req.body.mensaje,
                req.body.estado,
                currentDate(),
                currentTime()
            ]);

            await conec.commit(connection);
            return sendSave(res, "Hemos recibido tu mensaje. Te contactaremos pronto.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Consulta/add", error);
        }
    }

    async id(req, res) {
        try {
            const { idConsulta } = req.params;
            const result = await conec.query(`
            SELECT 
                * 
            FROM 
                consulta 
            WHERE 
                idConsulta = ?`, [
                idConsulta
            ]);

            return sendSuccess(res, result[0]);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Consulta/id", error);
        }
    }

    async update(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();
            await conec.execute(connection, `
            UPDATE 
                consulta 
            SET  
                nombre=?,
                email=?,
                celular=?,
                asunto=?,
                mensaje=?,
                estado=?
            WHERE 
                idConsulta=?`, [
                req.body.nombre,
                req.body.email,
                req.body.celular,
                req.body.asunto,
                req.body.mensaje,
                req.body.estado,
                req.body.idConsulta,
            ]);

            await conec.commit(connection);

            return sendSave(res, "Se actualizó correctamente la consulta.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Consulta/update", error);
        }
    }


    async detail(req, res) {
        try {
            const { idConsulta } = req.params;
            const consulta = await conec.query(`
            SELECT 
                idConsulta,
                nombre,
                email,
                celular,
                asunto,
                mensaje,
                estado,
                DATE_FORMAT(fecha, '%d/%m/%Y') AS fecha,
                hora
            FROM 
                consulta
            WHERE 
                idConsulta = ?`, [
                idConsulta
            ]);

            return sendSave(res, consulta[0]);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Consulta/detail", error);
        }
    }

    async delete(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const consulta = await conec.execute(connection, `
            SELECT 
                idConsulta
            FROM 
                consulta 
            WHERE 
                idConsulta = ?`, [
                req.query.idConsulta
            ]);

            if (consulta.length !== 0) {
                return sendClient(res, "No se puede anular la consulta porque no existe.")
            }

            await conec.execute(connection, `UPDATE consulta SET estado = 0 WHERE idConsulta = ?`, [
                req.query.idConsulta
            ]);

            await conec.commit(connection);
            return sendSave(res, "Se anuló correctamente la consulta.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Consulta/delete", error);
        }
    }

}

module.exports = Consulta;