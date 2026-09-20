const { calculateDepreciationToday } = require("../../../tools/Tools");

module.exports = ({ conec }) => async function findAllDepreciacion(data) {
    const { opcion, idProducto, idAlmacen, correlativo, posicionPagina, filasPorPagina } = data;
    const result = await conec.query(`
    SELECT 
        -- PRODUCTO
        p.idProducto,
        p.idMetodoDepreciacion,
        p.nombre AS producto,
        -- FECHA
        ia.fechaAdquisicion,
        ia.fechaDepreciacion,
        DATE_FORMAT(ia.fecha, '%d/%m/%Y') AS fecha,
        ia.hora,
        -- ALMACEN
        al.nombre AS almacen,
        -- MOVIMIENTO
        ia.cantidad,
        ia.costo,
        -- SERIE
        ia.idInventarioActivo,
        ia.serie, 
        ia.correlativo,
        ia.vidaUtil,
        ia.valorResidual,
        u.descripcion AS ubicacion
    FROM 
        inventarioActivo ia
    JOIN 
    	inventario i on i.idInventario = ia.idInventario
    JOIN producto p 
        ON p.idProducto = i.idProducto
    LEFT JOIN ubicacion u 
        ON u.idUbicacion = ia.idUbicacion
    JOIN almacen al 
        ON al.idAlmacen = i.idAlmacen
    WHERE 
        (? = 0 AND al.idAlmacen = ?)
    OR
        (? = 1 AND p.idProducto = ? AND al.idAlmacen = ?) 
    OR
        (? = 2 AND p.idProducto = ? AND al.idAlmacen = ? AND ia.correlativo = ?) 
    OR
        (? = 3 AND p.idProducto = ? AND ia.correlativo = ?) 
    GROUP BY
        p.idProducto,
        ia.idInventarioActivo,
        ia.serie
    ORDER BY 
        ia.fecha ASC,
        ia.hora  ASC
    LIMIT
        ?, ?`, [
        opcion,
        idAlmacen,

        opcion,
        idProducto,
        idAlmacen,
        
        opcion,
        idProducto,
        idAlmacen,
        correlativo,

        opcion,
        idProducto,
        correlativo,
        parseInt(posicionPagina),
        parseInt(filasPorPagina)
    ]);

    const list = result.map((item, index) => {
        const dep = calculateDepreciationToday(item);

        return {
            ...item,
            id: (index + 1) + parseInt(posicionPagina),
            depreciacionAcumuladaHoy: dep.depreciacionHoy,
            valorLibroHoy: dep.valorLibrosHoy,
            estadoDepreciacion: dep.estado
        };
    });

    const total = await conec.query(`
    SELECT COUNT(*) AS Total
    FROM 
        inventarioActivo ia
    JOIN inventario i
        ON ia.idInventario = i.idInventario
    JOIN producto p 
        ON p.idProducto = i.idProducto
    LEFT JOIN ubicacion u 
        ON u.idUbicacion = ia.idUbicacion
    JOIN almacen al 
        ON al.idAlmacen = i.idAlmacen
    WHERE 
        (? = 0 AND al.idAlmacen = ?)
    OR
        (? = 1 AND p.idProducto = ? AND al.idAlmacen = ?)
    OR
        (? = 2 AND p.idProducto = ? AND al.idAlmacen = ? AND ia.correlativo = ?)
    OR
        (? = 3 AND p.idProducto = ? AND ia.correlativo = ?) `, [
        opcion,
        idAlmacen,

        opcion,
        idProducto,
        idAlmacen,

        opcion,
        idProducto,
        idAlmacen,
        correlativo,

        opcion,
        idProducto,
        correlativo
    ]);
    console.log("total", total);

    return { "result": list, "total": total[0].Total };
}