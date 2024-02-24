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

            const ingreso = await conec.execute(connection, `
            SELECT 
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

            const venta = await conec.execute(connection, `
            SELECT 
                c.idVenta 
            FROM 
                venta AS c 
            INNER JOIN 
                ingreso AS s ON s.idVenta = c.idVenta 
            WHERE 
                c.idFormaPago = 'FP0001' AND s.idIngreso = ?`, [
                parseInt(req.query.idIngreso)
            ]);

            if (venta.length !== 0) {
                await conec.rollback(connection);
                return "No es posible cancelar este ingreso ya que corresponde a una venta al contado.";
            }

            const cobro = await conec.execute(connection, `
            SELECT 
                g.idCobro 
            FROM  
                cobro AS g
            INNER JOIN 
                ingreso AS s ON s.idCobro = g.idCobro 
            WHERE 
                s.idIngreso = ?`, [
                parseInt(req.query.idIngreso)
            ]);

            if (cobro.length !== 0) {
                await conec.rollback(connection);
                return "Para anular este ingreso, por favor diríjase al módulo de cobros y realice el proceso correspondiente";
            }

            const ingresos = await conec.execute(connection, `
            SELECT 
                idBancoDetalle 
            FROM 
                ingreso 
            WHERE 
                idIngreso = ?`, [
                parseInt(req.query.idIngreso)
            ]);

            await conec.execute(connection, `UPDATE ingreso 
            SET 
                estado = 0 
            WHERE 
                idIngreso = ?`, [
                parseInt(req.query.idIngreso)
            ]);

            for (const item of ingresos) {
                await conec.execute(connection, `UPDATE bancoDetalle 
                SET 
                    estado = 0 
                WHERE 
                    idBancoDetalle = ?`, [
                    item.idBancoDetalle
                ])
            }

            const plazoActual = await conec.execute(connection, `
            SELECT 
                p.idPlazo
            FROM 
                plazoIngreso AS pi
            INNER JOIN 
                plazo as p ON p.idPlazo = pi.idPlazo
            INNER JOIN 
                ingreso as i ON i.idIngreso = pi.idIngreso
            WHERE 
                i.idIngreso = ?`, [
                parseInt(req.query.idIngreso)
            ]);

            const plazo = await conec.execute(connection, `SELECT monto FROM plazo WHERE idPlazo = ?`, [
                plazoActual[0].idPlazo
            ]);

            const ingresoPlazo = await conec.execute(connection, `
            SELECT 
                i.monto 
            FROM 
                plazoIngreso AS pi
            INNER JOIN 
                plazo as p ON p.idPlazo = pi.idPlazo
            INNER JOIN 
                ingreso as i ON i.idIngreso = pi.idIngreso
            WHERE 
                p.idPlazo = ? AND i.estado = 1`, [
                plazoActual[0].idPlazo
            ]);

            const monto = plazo[0].monto;

            const actual = ingresoPlazo.reduce((accumulator, item) => accumulator + item.monto, 0)

            if (actual < monto) {
                await conec.execute(connection, `UPDATE plazo
                SET 
                    estado = 0
                WHERE 
                    idPlazo = ?`, [
                    plazoActual[0].idPlazo
                ])
            }

            const ventaActual = await conec.execute(connection, `
            SELECT
                idVenta
            FROM 
                ingreso
            WHERE 
                idIngreso = ?`, [
                parseInt(req.query.idIngreso)
            ]);

            const ventaDetalle = await conec.execute(connection, `
            SELECT 
                SUM(cd.cantidad * cd.precio) AS total
            FROM 
                venta AS c 
                INNER JOIN ventaDetalle AS cd ON cd.idVenta = c.idVenta
            WHERE 
                c.idVenta = ?`, [
                ventaActual[0].idVenta
            ]);

            const ingresoDetalle = await conec.execute(connection, `SELECT monto FROM ingreso WHERE idVenta = ? AND estado = 1`, [
                ventaActual[0].idVenta
            ]);

            const sumaIngresos = ingresoDetalle.reduce((accumulator, item) => accumulator + item.monto, 0);

            if (sumaIngresos < ventaDetalle[0].total) {
                await conec.execute(connection, `UPDATE venta
                SET 
                    estado = 2
                WHERE 
                    idVenta = ?`, [
                    ventaActual[0].idVenta
                ])
            }

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