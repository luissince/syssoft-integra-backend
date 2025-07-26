const Conexion = require('../database/Conexion');
const FirebaseService = require('../tools/FiraseBaseService');
const conec = new Conexion();
const firebaseService = new FirebaseService();

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

            const bucket = firebaseService.getBucket();

            // Genera lista con índice
            const resultLista = await Promise.all(lista.map(async (item, index) => {
                const lotes = await conec.query(`
                    SELECT 
                        l.idLote,
                        l.codigoLote,
                        DATE_FORMAT(l.fechaVencimiento, '%d/%m/%Y') AS fechaVencimiento,
                        DATEDIFF(l.fechaVencimiento, CURDATE()) AS diasRestantes,
                        l.cantidad,
                        a.nombre AS almacen,
                        a.direccion AS ubicacion,
                        CASE 
                        WHEN l.cantidad <= 10 THEN 'Crítico'
                        WHEN l.cantidad <= 30 THEN 'Bajo'
                        ELSE 'Óptimo'
                        END AS estado
                    FROM 
                        lote AS l
                    INNER JOIN 
                        inventario AS i ON i.idInventario = l.idInventario
                    INNER JOIN 
                        almacen AS a ON a.idAlmacen = i.idAlmacen
                    WHERE 
                        l.idInventario = ? AND l.cantidad > 0 AND l.estado = 1`,
                    [item.idInventario]
                );

                return {
                    ...item,
                    id: (index + 1) + parseInt(posicionPagina),
                    imagen: bucket && item.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : null,
                    lotes: lotes
                };
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

    async summary(req) {
        try {
            const cantidades = await conec.query(`
            SELECT
                COUNT(*) AS totalProductos,
                SUM(CASE WHEN i.cantidad <= i.cantidadMinima THEN 1 ELSE 0 END) AS totalStockCritico,
                SUM(CASE WHEN i.cantidad BETWEEN i.cantidadMinima AND i.cantidadMaxima THEN 1 ELSE 0 END) AS totalStockOptimo,
                SUM(CASE WHEN i.cantidad > i.cantidadMaxima THEN 1 ELSE 0 END) AS totalStockExcedente
            FROM 
                inventario i
            INNER JOIN 
                producto p ON p.idProducto = i.idProducto
            WHERE 
                i.idAlmacen = ?`, [
                req.params.idAlmacen
            ]);

            const lote = await conec.query(`
            SELECT 
                COUNT(*) AS totalLotesPorVencer
            FROM 
                lote AS l
            INNER JOIN 
                inventario AS i ON i.idInventario = l.idInventario
            INNER JOIN 
                almacen AS a ON a.idAlmacen = i.idAlmacen
            WHERE 
                    i.idAlmacen = ?
                AND 
                    DATEDIFF(l.fechaVencimiento, CURDATE()) BETWEEN 0 AND 30;`, [
                req.params.idAlmacen
            ]);

            return {
                ...cantidades[0],
                ...lote[0]
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