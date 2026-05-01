const { calculateDepreciationToday } = require("../../../tools/Tools");

module.exports = ({ conec }) => async function findAllDepreciacion(data) {
    const { opcion, idProducto, idAlmacen, posicionPagina, filasPorPagina } = data;

    const result = await conec.query(`
    SELECT 
        -- PRODUCTO
        p.idProducto,
        p.idMetodoDepreciacion,
        p.nombre AS producto,
        -- FECHA
        k.fecha AS fechaAdquisicion,
        DATE_FORMAT(k.fecha, '%d/%m/%Y') AS fecha,
        k.hora,
        -- ALMACEN
        al.nombre AS almacen,
        -- MOVIMIENTO
        ia.cantidad,
        k.costo,
        -- SERIE
        ia.idInventarioActivo,
        ia.serie,
        ia.vidaUtil,
        ia.valorResidual,
        u.descripcion AS ubicacion,
        da.idPersona,
        p2.informacion 
    FROM 
        kardex k
    JOIN inventario i
        ON k.idInventario = i.idInventario
    JOIN producto p 
        ON p.idProducto = i.idProducto
    JOIN tipoKardex tk 
        ON tk.IdTipoKardex = k.idTipoKardex
    JOIN inventarioActivo ia 
         ON ia.idInventario = K.idInventario and ia.estado = 'ASIGNADO'
    LEFT JOIN ubicacion u 
        ON u.idUbicacion = ia.idUbicacion
    JOIN almacen al 
        ON al.idAlmacen = i.idAlmacen
    LEFT JOIN documentoactivodetalle dd 
    	ON dd.idInventarioActivo = ia.idInventarioActivo 
    JOIN documentoactivo da 
    	ON da.idDocumentoActivo = dd.idDocumentoActivo
    JOIN persona p2 
    	on p2.idPersona = da.idPersona 
    WHERE 
        (? = 0 AND p.idProducto = ?)
    OR
        (? = 1 AND p.idProducto = ? AND al.idAlmacen = ?) 
    GROUP BY
        p.idProducto,
        p.idMetodoDepreciacion,
        ia.idInventarioActivo
    ORDER BY 
        k.fecha ASC,
        k.hora  ASC
    LIMIT
        ?, ?`, [
        opcion,
        idProducto,

        opcion,
        idProducto,
        idAlmacen,

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
    SELECT 
       COUNT(*) AS Total
    FROM 
        kardex k
    JOIN inventario i
        ON k.idInventario = i.idInventario
    JOIN producto p 
        ON p.idProducto = i.idProducto
    JOIN tipoKardex tk 
        ON tk.IdTipoKardex = k.idTipoKardex
    JOIN ubicacion u 
        ON u.idUbicacion = k.idUbicacion
    JOIN almacen al 
        ON al.idAlmacen = i.idAlmacen
    WHERE 
        (? = 0 AND p.idProducto = ?)
    OR
        (? = 1 AND p.idProducto = ? AND al.idAlmacen = ?)`, [
        opcion,
        idProducto,

        opcion,
        idProducto,
        idAlmacen,
    ]);

    return { "result": list, "total": total[0].Total };
}