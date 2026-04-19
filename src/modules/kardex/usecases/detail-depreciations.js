const { calculateDepreciationToday } = require("../../../tools/Tools");

module.exports = ({ conec, firebaseService }) => async function detailDepreciacion(data) {
    const { idProducto, serie } = data;

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
        p.idProducto,
        p.nombre AS producto,
        p.idMetodoDepreciacion,
        tk.nombre AS tipo,
        k.fecha AS fechaAdquisicion,
        DATE_FORMAT(k.fecha, '%d/%m/%Y') AS fecha,
        k.hora,
        k.detalle,
        k.cantidad,
        k.costo,
        ia.serie,
        ia.vidaUtil,
        ia.valorResidual,
        u.descripcion AS ubicacion
    FROM 
        kardex k
    JOIN
        inventario i ON k.idInventario = i.idInventario
    JOIN 
        producto p ON p.idProducto = i.idProducto
    JOIN 
        tipoKardex tk ON tk.IdTipoKardex = k.idTipoKardex
    LEFT JOIN 
        ubicacion u ON u.idUbicacion = k.idUbicacion
    JOIN 
        almacen al ON al.idAlmacen = i.idAlmacen
    JOIN
        inventarioactivo ia ON ia.idInventario = k.idInventario
    WHERE 
        p.idProducto = ?
    AND 
        ia.serie = ?
    ORDER BY 
        k.fecha ASC,
        k.hora ASC
    LIMIT 1`, [
        idProducto,
        serie
    ]);

    const metricas = calculateDepreciationToday(activo);

    const depreciaciones = await conec.query(`
    SELECT
        idDepreciacion,
        idProducto,
        serie,
        periodo,
        valorInicio,
        depreciacion,
        depreciacionAcumulada,
        valorLibros
    FROM 
        activoDepreciacion
    WHERE 
        idProducto = ?
    AND 
        serie = ?
    ORDER BY 
        periodo ASC`, [
        idProducto,
        serie
    ]);

    return {
        producto: {
            ...producto,
            imagen: bucket && producto.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${producto.imagen}` : null,
        },
        activo,
        metricas,
        depreciaciones
    }
}