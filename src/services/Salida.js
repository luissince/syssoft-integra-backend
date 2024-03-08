const Conexion = require('../database/Conexion');
require('../tools/Tools');
const conec = new Conexion();

class Salida {

    async list(req) {
        try {
            const lista = await conec.procedure(`CALL Listar_Salidas(?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_Salidas_Count(?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,
            ]);

            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async cancel(req) {
        // Inicialización de la conexión a la base de datos.
        let connection = null;
        try {
            // Inicio de la transacción.
            connection = await conec.beginTransaction();

            // Verificación de existencia y estado de la salida.
            const salida = await conec.execute(connection, `SELECT 
                idSalida, 
                estado 
            FROM 
                salida 
            WHERE 
                idSalida = ?`, [
                parseInt(req.query.idSalida)
            ]);

            // Si la salida no existe, se realiza un rollback y se retorna un mensaje.
            if (salida.length === 0) {
                await conec.rollback(connection);
                return "La salida no existe, verifique el código o actualice la lista.";
            }

            // Si la salida ya está cancelada, se realiza un rollback y se retorna un mensaje.
            if (salida[0].estado === 0) {
                await conec.rollback(connection);
                return "La salida ya se encuentra con estado cancelado.";
            }

            // Verificación de si la salida está asociada a una compra al contado.
            const compra = await conec.execute(connection, `SELECT 
                c.idCompra 
            FROM compra AS c 
                INNER JOIN salida AS s ON s.idCompra = c.idCompra 
            WHERE 
                c.tipo = 1 AND s.idSalida = ?`, [
                parseInt(req.query.idSalida)
            ]);

            // Si la salida está asociada a una compra al contado, se realiza un rollback y se retorna un mensaje.
            if (compra.length !== 0) {
                await conec.rollback(connection);
                return "No se puede anular la salida porque es una compra al contado.";
            }

            // Verificación de si la salida está asociada a un gasto al contado.
            const gasto = await conec.execute(connection, `SELECT 
                g.idGasto 
            FROM gasto AS g
                INNER JOIN salida AS s ON s.idGasto = g.idGasto 
            WHERE 
                c.tipo = 1 AND s.idSalida = ?`, [
                parseInt(req.query.idSalida)
            ]);

            // Si la salida está asociada a un gasto al contado, se realiza un rollback y se retorna un mensaje.
            if (gasto.length !== 0) {
                await conec.rollback(connection);
                return "No se puede anular la salida porque es un gasto al contado.";
            }

            // Actualización del estado de la salida a cancelado.
            await conec.execute(connection, `UPDATE salida 
            SET 
                estado = 0 
            WHERE 
                idSalida = ?`, [
                parseInt(req.query.idSalida)
            ]);

            // Confirmación de la transacción.
            await conec.commit(connection);
            return "cancel";
        } catch (error) {
            // Manejo de errores y rollback en caso de fallo.
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

}

module.exports = Salida;