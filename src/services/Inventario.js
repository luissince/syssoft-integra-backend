const conec = require('../database/mysql-connection');
const firebaseService = require('../common/fire-base');

class Inventario {

    async list(req) {
        try {
            const {
                opcion,
                buscar,
                idAlmacen,
                estado,
                posicionPagina,
                filasPorPagina
            } = req.query;

            const lista = await conec.procedure(`CALL Listar_Inventario(?,?,?,?,?,?)`, [
                parseInt(opcion),
                buscar,
                idAlmacen,
                estado,
                parseInt(posicionPagina),
                parseInt(filasPorPagina)
            ]);

            const bucket = firebaseService.getBucket();

            // Genera lista con índice
            const resultLista = await Promise.all(lista.map(async (item, index) => {
                return {
                    ...item,
                    id: (index + 1) + parseInt(posicionPagina),
                    imagen: bucket && item.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : null,
                };
            }));

            const total = await conec.procedure(`CALL Listar_Inventario_Count(?,?,?,?)`, [
                parseInt(opcion),
                buscar,
                idAlmacen,
                estado,
            ]);

            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async summary(req) {
        try {
            const cantidades = await conec.query(`
            SELECT
                COUNT(*) AS totalProductos,
                SUM(CASE WHEN i.cantidad < i.cantidadMinima THEN 1 ELSE 0 END) AS totalStockCritico,
                SUM(CASE WHEN i.cantidad >= i.cantidadMinima AND i.cantidad <= i.cantidadMaxima THEN 1 ELSE 0 END) AS totalStockOptimo,
                SUM(CASE WHEN i.cantidad > i.cantidadMaxima THEN 1 ELSE 0 END) AS totalStockExcedente
            FROM 
                inventario i
            INNER JOIN 
                producto p ON p.idProducto = i.idProducto AND p.estado <> -1
            WHERE 
                i.idAlmacen = ?`, [
                req.params.idAlmacen
            ]);

            return {
                ...cantidades[0],
            }
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async getStock(req) {
        try {
            const result = await conec.query(`
            SELECT 
                cantidadMaxima, 
                cantidadMinima 
            FROM 
                inventario 
            WHERE 
                idInventario = ?`, [
                req.query.idInventario
            ])

            return result[0]
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async updateStock(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            await conec.execute(connection, `
            UPDATE 
                inventario 
            SET 
                cantidadMaxima = ?,
                cantidadMinima = ?
            WHERE 
                idInventario = ?`, [
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