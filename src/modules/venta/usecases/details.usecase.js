

module.exports = ({ conec }) => async function details(data) {
    const { idVenta } = data;
    // Obtener detalles de productos vendidos en la venta
    const detalle = await conec.query(`
    SELECT 
        p.codigo,
        p.nombre AS producto,
        md.nombre AS medida, 
        m.nombre AS categoria, 
        vd.idProducto,
        vd.precio,
        vd.cantidad,
        vd.idImpuesto,
        imp.nombre AS impuesto,
        imp.porcentaje
    FROM 
        ventaDetalle AS vd 
    INNER JOIN 
        producto AS p ON vd.idProducto = p.idProducto 
    INNER JOIN 
        medida AS md ON md.idMedida = p.idMedida 
    INNER JOIN 
        categoria AS m ON p.idCategoria = m.idCategoria 
    INNER JOIN 
        impuesto AS imp ON vd.idImpuesto  = imp.idImpuesto  
    WHERE 
        vd.idVenta = ?
    ORDER BY 
        vd.idVentaDetalle ASC`, [
        idVenta
    ]);

    // Enviar respuesta exitosa con la información recopilada
    return detalle;
}