const Conexion = require('../database/Conexion');
const { currentDate, currentTime } = require('../tools/Tools');
const { sendSuccess, sendClient, sendError, sendSave, sendNotFound } = require('../tools/Message');
const conec = new Conexion();

class Moneda {

    async list(req, res) {
        try {
            const lista = await conec.query(`SELECT 
                idMoneda, 
                nombre, 
                codiso, 
                simbolo, 
                estado,
                nacional
                FROM moneda 
                WHERE 
                ? = 0
                OR
                ? = 1 AND (nombre like concat(?,'%') OR  codiso like concat(?,'%'))

                LIMIT ?,?`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar,
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
                FROM moneda  
                WHERE 
                ? = 0
                OR
                ? = 1 AND (nombre like concat(?,'%') OR  codiso like concat(?,'%'))`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.buscar,
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async add(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const result = await conec.execute(connection, 'SELECT idMoneda FROM moneda');
            const idMoneda = generateAlphanumericCode("MN0001", result, 'idMoneda');

            await conec.execute(connection, `INSERT INTO moneda(
                idMoneda,
                nombre, 
                codiso, 
                simbolo,
                estado,
                nacional,
                fecha, 
                hora, 
                fupdate,
                hupdate,
                idUsuario) 
                values (?,?,?,?,?,?,?,?,?,?,?)`, [
                idMoneda,
                req.body.nombre,
                req.body.codiso,
                req.body.simbolo,
                req.body.estado,
                0,
                currentDate(),
                currentTime(),
                currentDate(),
                currentTime(),
                req.body.idUsuario,
            ])

            await conec.commit(connection);
            return sendSave(res, 'Datos insertados correctamente.');
        } catch (err) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async update(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            await conec.execute(connection, `UPDATE moneda SET 
            nombre=?, 
            codiso=?,
            simbolo=?, 
            estado=?,
            fecha=?,
            hora=?,
            idUsuario=? 
            where idMoneda=?`, [
                req.body.nombre,
                req.body.codiso,
                req.body.simbolo,
                req.body.estado,
                currentDate(),
                currentTime(),
                req.body.idUsuario,
                req.body.idMoneda,
            ])

            await conec.commit(connection);
            return sendSave(res, 'Se actualizó correctamente los datos.');
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(error, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async id(req, res) {
        try {
            const result = await conec.query('SELECT * FROM moneda WHERE idMoneda = ?', [
                req.query.idMoneda,
            ]);

            if (result.length > 0) {
                return sendSuccess(res, result[0]);
            }

            return sendClient(res, "Datos no encontrados");
        } catch (error) {
            return sendError(error, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async delete(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const banco = await conec.execute(connection, `SELECT * FROM banco WHERE idMoneda = ?`, [
                req.query.idMoneda
            ]);

            if (banco.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar la moneda ya que esta ligada a un banco.');
            }

            const cobro = await conec.execute(connection, `SELECT * FROM  cobro WHERE idMoneda = ?`, [
                req.query.idMoneda
            ]);

            if (cobro.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar la moneda ya que esta ligada a un cobro.');
            }

            const gasto = await conec.execute(connection, `SELECT * FROM  gasto WHERE idMoneda = ?`, [
                req.query.idMoneda
            ]);

            if (gasto.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar la moneda ya que esta ligada a un gasto.');
            }

            const venta = await conec.execute(connection, `SELECT * FROM venta WHERE idMoneda = ?`, [
                req.query.idMoneda
            ]);

            if (venta.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar la moneda ya que esta ligada a un venta.');
            }

            await conec.execute(connection, `DELETE FROM moneda WHERE idMoneda  = ?`, [
                req.query.idMoneda
            ]);

            await conec.commit(connection)
            return sendSave(res, 'Se eliminó correctamente la moneda.');
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async combo(req, res) {
        try {
            const result = await conec.query(`SELECT 
            idMoneda,
            nombre, 
            simbolo, 
            codiso, 
            nacional 
            FROM moneda 
            WHERE estado = 1`);
            return sendSuccess(res, result);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async nacional(req, res) {
        try {
            const result = await conec.query(`SELECT 
            idMoneda,
            nombre, 
            simbolo, 
            codiso 
            FROM moneda 
            WHERE nacional = 1`);
            if (result.length >= 1) {
                return sendSuccess(res, result[0]);
            }
            
            return sendNotFound(res, "No hay datos para mostrar")
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

}

module.exports = new Moneda();