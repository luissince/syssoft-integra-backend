const conec = require('../database/mysql-connection');
const firebaseService = require('../common/fire-base');

class KardexService {

    async list(data) {
        try {
            const kardex = await conec.procedure(`CALL Listar_Kardex(?,?,?)`, [
                data.idAlmacen,
                data.idProducto,
                data.idSucursal,
            ]);


            const resultLista = kardex.map((item, index) => ({
                ...item,
                id: index + 1,
            }));

            return resultLista;
        } catch (error) {
            throw error;
        }
    }

    async listDepreciacion(data) {
        try {
            const { idProducto, idAlmacen, posicionPagina, filasPorPagina } = data;

            const result = await conec.query(`
            SELECT 
                -- PRODUCTO
                p.idProducto,
                p.nombre AS producto,
                -- TIPO MOVIMIENTO
                tk.nombre AS tipo,
                -- FECHA
                DATE_FORMAT(k.fecha, '%d/%m/%Y') AS fecha,
                k.hora,
                -- ORIGEN MOVIMIENTO
                CASE 
                    WHEN k.idVenta    IS NOT NULL THEN 'venta'
                    WHEN k.idAjuste   IS NOT NULL THEN 'ajuste'
                    WHEN k.idCompra   IS NOT NULL THEN 'compra'
                    WHEN k.idTraslado IS NOT NULL THEN 'traslado'
                    ELSE 'otro'
                END AS opcion,
                -- ID REFERENCIA
                CASE 
                    WHEN k.idVenta    IS NOT NULL THEN k.idVenta
                    WHEN k.idAjuste   IS NOT NULL THEN k.idAjuste
                    WHEN k.idCompra   IS NOT NULL THEN k.idCompra
                    WHEN k.idTraslado IS NOT NULL THEN k.idTraslado
                    ELSE 'N/A'
                END AS idNavegacion,
                -- DETALLE
                k.detalle,
                -- MOVIMIENTO
                k.cantidad,
                k.costo,
                -- SERIE
                k.serie,
                k.vidaUtil,
                k.valorResidual,
                u.descripcion AS ubicacion
            FROM kardex k
            JOIN producto p 
                ON p.idProducto = k.idProducto
            JOIN tipoKardex tk 
                ON tk.IdTipoKardex = k.idTipoKardex
            JOIN ubicacion u 
                ON u.idUbicacion = k.idUbicacion
            JOIN almacen al 
                ON al.idAlmacen = k.idAlmacen
            WHERE 
                    p.idProducto = ?
                AND 
                    al.idAlmacen = ?      
            GROUP BY
                k.serie
            ORDER BY 
                k.fecha ASC,
                k.hora  ASC
            LIMIT
                ?, ?`, [
                idProducto,
                idAlmacen,
                parseInt(posicionPagina),
                parseInt(filasPorPagina)
            ]);

            const list = result.map((item, index) => ({
                ...item,
                id: (index + 1) + parseInt(posicionPagina)
            }));

            const total = await conec.query(`
            SELECT 
               COUNT(*) AS Total
            FROM 
                kardex k
            JOIN producto p 
                ON p.idProducto = k.idProducto
            JOIN tipoKardex tk 
                ON tk.IdTipoKardex = k.idTipoKardex
            JOIN ubicacion u 
                ON u.idUbicacion = k.idUbicacion
            JOIN almacen al 
                ON al.idAlmacen = k.idAlmacen
            WHERE 
                    p.idProducto = ?
                AND 
                    al.idAlmacen = ?`, [
                idProducto,
                idAlmacen,
            ]);

            return { "result": list, "total": total[0].Total };
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async detailtDepreciacion(data) {
        const { idProducto, serie } = data;

        try {
            const bucket = firebaseService.getBucket();

            const [producto] = await conec.query(`
            SELECT 
                p.idProducto,
                p.imagen,
                p.codigo,
                p.sku,
                p.codigoBarras,
                p.nombre,
                p.costo,
                pc.valor AS precio,
                c.nombre AS categoria,
                tp.nombre as tipoProducto,
                p.idTipoTratamientoProducto,
                p.idTipoProducto,
                p.idMetodoDepreciacion,
                p.idMedida,
                me.nombre AS unidad
            FROM 
                producto AS p
            INNER JOIN 
                medida AS me ON me.idMedida = p.idMedida
            INNER JOIN 
                categoria AS c ON c.idCategoria = p.idCategoria
            INNER JOIN 
                tipoProducto AS tp ON tp.idTipoProducto = p.idTipoProducto
            INNER JOIN 
                precio AS pc ON pc.idProducto = p.idProducto AND pc.preferido = 1
            WHERE 
                p.idProducto = ?`, [
                idProducto
            ]);

            const [activo] = await conec.query(`
            SELECT 
                -- PRODUCTO
                p.idProducto,
                p.nombre AS producto,
                -- TIPO MOVIMIENTO
                tk.nombre AS tipo,
                -- FECHA
                DATE_FORMAT(k.fecha, '%d/%m/%Y') AS fecha,
                k.hora,
                -- ORIGEN MOVIMIENTO
                CASE 
                    WHEN k.idVenta    IS NOT NULL THEN 'venta'
                    WHEN k.idAjuste   IS NOT NULL THEN 'ajuste'
                    WHEN k.idCompra   IS NOT NULL THEN 'compra'
                    WHEN k.idTraslado IS NOT NULL THEN 'traslado'
                    ELSE 'otro'
                END AS opcion,
                -- ID REFERENCIA
                CASE 
                    WHEN k.idVenta    IS NOT NULL THEN k.idVenta
                    WHEN k.idAjuste   IS NOT NULL THEN k.idAjuste
                    WHEN k.idCompra   IS NOT NULL THEN k.idCompra
                    WHEN k.idTraslado IS NOT NULL THEN k.idTraslado
                    ELSE 'N/A'
                END AS idNavegacion,
                -- DETALLE
                k.detalle,
                -- MOVIMIENTO
                k.cantidad,
                k.costo,
                -- SERIE
                k.serie,
                k.vidaUtil,
                k.valorResidual,
                u.descripcion AS ubicacion
            FROM 
                kardex k
            JOIN producto p 
                ON p.idProducto = k.idProducto
            JOIN tipoKardex tk 
                ON tk.IdTipoKardex = k.idTipoKardex
            JOIN ubicacion u 
                ON u.idUbicacion = k.idUbicacion
            JOIN almacen al 
                ON al.idAlmacen = k.idAlmacen
            WHERE 
                    p.idProducto = ?
                AND 
                    k.serie = ?      
            GROUP BY
                k.serie`, [
                idProducto,
                serie
            ]);

            // const depreciacion = await conec.query(``);
            return {
                producto: {
                    ...producto,
                    imagen: bucket && producto.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${producto.imagen}` : null,
                },
                activo
            };
        } catch (error) {
            throw error;
        }
    }

    async createDepreciacion(data) {
        try {


        } catch (error) {
            throw error;
        }
    }

}

module.exports = new KardexService();