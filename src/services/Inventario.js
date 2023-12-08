const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Inventario {

    async list(req) {
        try {
            const {
                opcion,
                buscar,
                idSucursal,
                idAlmacen,
                posicionPagina,
                filasPorPagina
            } = req.query;

            const lista = await conec.procedure(`CALL Listar_Inventario(?,?,?,?,?,?)`, [
                parseInt(opcion),
                buscar,
                idSucursal,
                idAlmacen,
                parseInt(posicionPagina),
                parseInt(filasPorPagina)
            ]);

            const resultLista = lista.map((item, index) => ({
                ...item,
                id: (index + 1) + parseInt(posicionPagina)
            }));

            const total = await conec.procedure(`CALL Listar_Inventario_Count(?,?,?,?)`, [
                parseInt(opcion),
                buscar,
                idSucursal,
                idAlmacen,
            ]);

            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async obtenerStock(req) {
        try {
            const result = await conec.query(`SELECT 
            cantidadMaxima, 
            cantidadMinima 
            FROM inventario 
            WHERE idInventario = ?`, [
                req.query.idInventario
            ])

            return result[0]
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async actualizarStock(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            await conec.execute(connection, `UPDATE inventario SET 
            cantidadMaxima = ?,
            cantidadMinima = ?
            WHERE idInventario = ?`, [
                req.body.stockMaximo,
                req.body.stockMinimo,
                req.body.idInventario,
            ])

            await conec.commit(connection);
            return 'update';
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

}

module.exports = Inventario;