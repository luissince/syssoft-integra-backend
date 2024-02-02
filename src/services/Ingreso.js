const Conexion = require('../database/Conexion');
require('../tools/Tools');
const conec = new Conexion();

class Ingreso {

    async list(req) {
        try {
            // Llamada al procedimiento almacenado para listar ingresos.
            const lista = await conec.procedure(`CALL Listar_Ingresos(?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            // Mapeo de la lista para agregar un identificador único a cada elemento.
            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                };
            });

            // Llamada al procedimiento almacenado para obtener el total de ingresos.
            const total = await conec.procedure(`CALL Listar_Ingresos_Count(?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,
            ]);

            // Retorno de los resultados y el total.
            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {            
            // Manejo de errores y retorno de un mensaje de error.
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async cancel(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();
           
            const ingreso = await conec.execute(connection, `SELECT 
                idIngreso, 
                estado 
            FROM 
                ingreso 
            WHERE 
                idIngreso = ?`, [
                parseInt(req.query.idIngreso)
            ]);

            if (ingreso.length === 0) {
                await conec.rollback(connection);
                return "El ingreso no existe, verifique el código o actualice la lista.";
            }

            if (ingreso[0].estado === 0) {
                await conec.rollback(connection);
                return "El ingreso ya se encuentra con estado cancelado.";
            }

            const venta = await conec.execute(connection, `SELECT 
                c.idVenta 
            FROM venta AS c 
                INNER JOIN ingreso AS s ON s.idVenta = c.idVenta 
            WHERE 
                c.tipo = 1 AND s.idIngreso = ?`, [
                parseInt(req.query.idIngreso)
            ]);

            if (venta.length !== 0) {
                await conec.rollback(connection);
                return "No se puede anular la salida porque es una venta al contado.";
            }

            const cobro = await conec.execute(connection, `SELECT 
                g.idCobro 
            FROM  cobro AS g
                INNER JOIN ingreso AS s ON s.idCobro = g.idCobro 
            WHERE 
                c.tipo = 1 AND s.idIngreso = ?`, [
                parseInt(req.query.idIngreso)
            ]);

            if (cobro.length !== 0) {
                await conec.rollback(connection);
                return "No se puede anular el ingreso porque es un pago al contado.";
            }

            await conec.execute(connection, `UPDATE ingreso 
            SET 
                estado = 0 
            WHERE 
                idIngreso = ?`, [
                parseInt(req.query.idIngreso)
            ]);

            await conec.commit(connection);
            return "cancel";
        } catch (error) {       
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

}

module.exports = Ingreso;