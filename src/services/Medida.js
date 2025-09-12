const conec = require('../database/mysql-connection');
const { currentDate, currentTime, generateAlphanumericCode } = require("../tools/Tools");

class Medida {

    async list(req) {
        try {
            const lista = await conec.query(`SELECT 
                m.idMedida,
                m.codigo,
                m.nombre,     
                m.descripcion,     
                m.estado,
                DATE_FORMAT(m.fecha,'%d/%m/%Y') as fecha,
                m.hora
                FROM medida AS m 
                WHERE
                ? = 0  
                OR
                ? = 1 AND m.nombre LIKE CONCAT(?,'%')
                LIMIT ?,?`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar,

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina),
            ]);

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: index + 1 + parseInt(req.query.posicionPagina),
                };
            });

            const total = await conec.query(`SELECT COUNT(*) AS Total     
                FROM medida AS m
                WHERE
                ? = 0 
                OR
                ? = 1 AND m.nombre LIKE CONCAT(?,'%')`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar,
            ]);

            return { result: resultLista, total: total[0].Total };
        } catch (error) {
            return "Error interno de conexión, intente nuevamente.";
        }
    }

    async id(req) {
        try {
            const result = await conec.query(`SELECT
                codigo,
                nombre,
                descripcion,
                estado
                FROM medida 
                WHERE idMedida = ?`, [
                req.query.idMedida
            ]);

            return result[0];
        } catch (error) {
            return "Error interno de conexión, intente nuevamente.";
        }
    }

    async add(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const result = await conec.execute(connection, "SELECT idMedida FROM medida");
            const idMedida = generateAlphanumericCode("MD0001", result, 'idMedida');

            await conec.execute(connection, `INSERT INTO medida(
                idMedida,
                codigo,
                nombre,
                descripcion,
                estado,
                preferida,
                fecha,
                hora,
                idUsuario
            ) VALUES(?,?,?,?,?,?,?,?,?)`, [
                idMedida,
                req.body.codigo,
                req.body.nombre,
                req.body.descripcion,
                req.body.estado,
                0,
                currentDate(),
                currentTime(),
                req.body.idUsuario,
            ]);

            await conec.commit(connection);
            return "insert";
        } catch (error) {          
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Error interno de conexión, intente nuevamente.";
        }
    }

    async edit(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            await conec.execute(connection, `UPDATE medida SET
                codigo = ?,
                nombre = ?,
                descripcion = ?,
                estado = ?,
                idUsuario = ?
            WHERE idMedida  = ?`, [
                req.body.codigo,
                req.body.nombre,
                req.body.descripcion,
                req.body.estado,
                req.body.idUsuario,
                req.body.idMedida
            ]);

            await conec.commit(connection);
            return "update";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Error interno de conexión, intente nuevamente.";
        }
    }

    async delete(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const producto = await conec.execute(connection, `SELECT * FROM producto WHERE idMedida = ?`, [
                req.query.idMedida
            ]);

            if (producto.length > 0) {
                await conec.rollback(connection);
                return "No se puede eliminar la medida ya que esta ligada a un producto.";
            }

            await conec.execute(connection, `DELETE FROM medida WHERE idMedida  = ?`, [
                req.query.idMedida
            ]);

            await conec.commit(connection);
            return "delete";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Error interno de conexión, intente nuevamente.";
        }
    }

    async combo(req) {
        try {
            const result = await conec.query(`SELECT 
            idMedida,
            nombre
            FROM medida 
            WHERE estado = 1`);
            return result;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

}

module.exports = Medida;