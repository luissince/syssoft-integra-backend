const Conexion = require('../database/Conexion');
const { currentDate, currentTime, generateAlphanumericCode } = require('../tools/Tools');
const { sendSuccess, sendClient, sendError, sendSave } = require('../tools/Message');
const conec = new Conexion();

class Vehiculo {

    async list(req, res) {
        try {
            const lista = await conec.query(`SELECT 
            idVehiculo,
            marca,
            numeroPlaca,
            preferido,
            estado,
            DATE_FORMAT(fecha,'%d/%m/%Y') as fecha, 
            hora
            FROM vehiculo
            WHERE 
            ? = 0
            OR
            ? = 1 and marca like concat(?,'%')
            OR
            ? = 1 and numeroPlaca like concat(?,'%')
            LIMIT ?,?`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar,

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

            const total = await conec.query(`SELECT COUNT(*) AS Total FROM vehiculo
            WHERE 
            ? = 0
            OR
            ? = 1 and marca like concat(?,'%')
            OR
            ? = 1 and numeroPlaca like concat(?,'%')`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar,

                parseInt(req.query.opcion),
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

            const resultVehiculo = await conec.execute(connection, 'SELECT idVehiculo FROM vehiculo');
            const idVehiculo = generateAlphanumericCode("VH0001", resultVehiculo, 'idVehiculo');

            if (req.body.preferido) {
                await conec.execute(connection, `UPDATE vehiculo SET preferido = 0`);
            }

            await conec.execute(connection, `INSERT INTO vehiculo(
                idVehiculo, 
                marca,
                numeroPlaca,
                preferido,
                estado,
                fecha,
                hora,
                idUsuario) 
                VALUES(?,?,?,?,?,?,?,?)`, [
                idVehiculo,
                req.body.marca,
                req.body.numeroPlaca,
                req.body.preferido,
                req.body.estado,
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async id(req, res) {
        try {
            const result = await conec.query('SELECT * FROM vehiculo WHERE idVehiculo  = ?', [
                req.query.idVehiculo
            ]);

            if (result.length > 0) {
                return sendSuccess(res, result[0]);
            } else {
                return sendClient(res, "Datos no encontrados");
            }

        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async edit(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            if (req.body.preferido) {
                await conec.execute(connection, `UPDATE vehiculo SET preferido = 0`);
            }

            await conec.execute(connection, `UPDATE vehiculo 
            SET 
                marca=?,
                numeroPlaca=?,
                preferido=?,
                estado=?,
                idUsuario=?
            WHERE 
                idVehiculo=?`, [
                req.body.marca,
                req.body.numeroPlaca,
                req.body.preferido,
                req.body.estado,
                req.body.idUsuario,
                req.body.idVehiculo
            ])

            await conec.commit(connection)
            return sendSave(res, 'Los datos se actualizarón correctamente.');
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

            const guiaRemision = await conec.execute(connection, `SELECT * FROM guiaRemision WHERE idVehiculo = ?`, [
                req.query.idVehiculo
            ]);

            if (guiaRemision.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el vehículo, ya que esta ligado a una guía de remisión.');
            }

            const preferida = await conec.execute(connection, `SELECT * FROM vehiculo WHERE preferido = 1 AND idVehiculo = ?`,[
                req.query.idVehiculo
            ]);

            if (preferida.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'El vehículo tiene el estado preferida, cambie el valor para poder eliminar.');
            }

            await conec.execute(connection, `DELETE FROM vehiculo WHERE idVehiculo = ?`, [
                req.query.idVehiculo
            ]);

            await conec.commit(connection)
            return sendSave(res, 'Se eliminó correctamente el vehículo.');
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
                idVehiculo,
                marca,
                numeroPlaca,
                preferido 
            FROM 
                vehiculo 
            WHERE 
                estado = 1`);
            return sendSuccess(res, result);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async filter(req, res) {
        try {           
            const result = await conec.query(`SELECT 
                idVehiculo,
                marca,
                numeroPlaca
            FROM 
                vehiculo 
            WHERE 
                estado = 1 AND 
                (
                    marca LIKE CONCAT('%',?,'%') 
                    OR 
                    numeroPlaca LIKE CONCAT('%',?,'%')
                )`, [
                req.query.filter,
                req.query.filter,
            ]);
            return sendSuccess(res, result);
        } catch (error) {         
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }
}

module.exports = new Vehiculo();