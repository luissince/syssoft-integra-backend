

module.exports = ({ conec, firebaseService }) => async function detail(data) {
    const { idVenta } = data;

    // Obtener información general de la venta
    const result = await conec.query(`
    SELECT
        v.idVenta, 
        com.nombre AS comprobante,
        com.codigo as codigoVenta,
        v.serie,
        v.numeracion,
        td.nombre AS tipoDoc,      
        td.codigo AS codigoCliente,      
        c.documento,
        c.informacion,
        c.direccion,
        c.celular,
        c.email,
        pu.informacion AS usuario,
        DATE_FORMAT(v.fecha,'%d/%m/%Y') as fecha,
        v.hora, 
        v.idFormaPago, 
        v.estado, 
        m.simbolo,
        m.codiso,
        m.nombre as moneda,
        v.observacion,
        v.nota
    FROM 
        venta AS v 
    INNER JOIN 
        persona AS c ON v.idCliente = c.idPersona
    INNER JOIN 
        formaPago AS fc ON fc.idFormaPago = v.idFormaPago
    INNER JOIN 
        moneda AS m ON m.idMoneda = v.idMoneda
    INNER JOIN 
        usuario AS us ON us.idUsuario = v.idUsuario
    INNER JOIN
        persona AS pu ON pu.idPersona = us.idPersona
    INNER JOIN 
        tipoDocumento AS td ON td.idTipoDocumento = c.idTipoDocumento 
    INNER JOIN 
        comprobante AS com ON v.idComprobante = com.idComprobante
    WHERE 
        v.idVenta = ?`, [
        idVenta
    ]);

    // Obtener detalles de productos vendidos en la venta
    const detalles = await conec.query(`
    SELECT 
        ROW_NUMBER() OVER (ORDER BY vd.idVentaDetalle ASC) AS id,
        p.codigo,
        p.nombre AS producto,
        p.imagen,
        md.nombre AS medida, 
        m.nombre AS categoria, 
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

    const bucket = firebaseService.getBucket();

    const listaDetalles = detalles.map(item => {
        if (bucket && item.imagen) {
            return {
                ...item,
                imagen: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
            }
        }
        return {
            ...item,
        }
    });

    // Obtener información de transaccion asociados a la venta
    const transaccion = await conec.query(`
    SELECT 
        t.idTransaccion,
        DATE_FORMAT(t.fecha,'%d/%m/%Y') AS fecha,
        t.hora,
        c.nombre AS concepto,
        t.nota,
        pu.informacion AS usuario
    FROM 
        transaccion t            
    INNER JOIN
        concepto c ON c.idConcepto = t.idConcepto
    INNER JOIN 
        usuario AS us ON us.idUsuario = t.idUsuario
    INNER JOIN
        persona AS pu ON pu.idPersona = us.idPersona
    WHERE 
        t.idReferencia = ?`, [
        idVenta
    ]);

    for (const item of transaccion) {
        const transacciones = await conec.query(`
        SELECT 
            b.nombre,
            td.monto,
            td.observacion
        FROM
            transaccionDetalle td
        INNER JOIN 
            banco b on td.idBanco = b.idBanco     
        WHERE 
            td.idTransaccion = ?`, [
            item.idTransaccion
        ]);

        item.detalles = transacciones;
    }

    // Enviar respuesta exitosa con la información recopilada
    return { "cabecera": result[0], detalles: listaDetalles, transaccion };
}