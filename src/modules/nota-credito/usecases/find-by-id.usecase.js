module.exports = ({ conec, firebaseService }) => async function findById(data) {
    const { idNotaCredito } = data;

    // Obtener información general de la nota de crédito
    const result = await conec.query(`
    SELECT 
        nc.idNotaCredito,
        DATE_FORMAT(nc.fecha,'%d/%m/%Y') as fecha,
        nc.hora,

        td.nombre AS tipoDocumento,
        cn.documento,
        cn.informacion,

        co.nombre AS comprobante,
        nc.serie,
        nc.numeracion,

        mt.nombre AS motivo,

        cv.nombre AS comprobanteVenta,
        v.serie AS serieVenta,
        v.numeracion AS numeracionVenta,

        nc.estado,
        m.codiso,
        nc.observacion
    FROM 
        notaCredito AS nc
    INNER JOIN
        persona AS cn ON cn.idPersona = nc.idCliente
    INNER JOIN
        tipoDocumento AS td ON td.idTipoDocumento = cn.idTipoDocumento
    INNER JOIN
        comprobante AS co ON nc.idComprobante = co.idComprobante
    INNER JOIN
        motivo AS mt ON mt.idMotivo = nc.idMotivo
    INNER JOIN
        venta AS v ON v.idVenta = nc.idVenta
    INNER JOIN
        comprobante AS cv on cv.idComprobante = v.idComprobante
    INNER JOIN
        moneda AS m ON m.idMoneda = nc.idMoneda
    WHERE
        nc.idNotaCredito = ?`, [
        idNotaCredito
    ]);

    // Obtener detalles de productos vendidos en la venta
    const detalles = await conec.query(`
    SELECT 
        ROW_NUMBER() OVER (ORDER BY ncd.idNotaCreditoDetalle ASC) AS id,
        p.codigo,
        p.nombre AS producto,
        p.imagen,
        md.nombre AS medida, 
        m.nombre AS categoria, 
        ncd.precio,
        ncd.cantidad,
        ncd.idImpuesto,
        imp.nombre AS impuesto,
        imp.porcentaje
    FROM 
        notaCreditoDetalle AS ncd
    INNER JOIN 
        producto AS p ON ncd.idProducto = p.idProducto 
    INNER JOIN 
        medida AS md ON md.idMedida = p.idMedida 
    INNER JOIN 
        categoria AS m ON p.idCategoria = m.idCategoria 
    INNER JOIN 
        impuesto AS imp ON ncd.idImpuesto  = imp.idImpuesto  
    WHERE
        ncd.idNotaCredito = ?
    ORDER BY 
        ncd.idNotaCreditoDetalle ASC`, [
        idNotaCredito
    ]);

    const bucket = firebaseService.getBucket();

    const nuevosDetalles = detalles.map(item => ({
        ...item,
        imagen: bucket && item.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : null,
    }));

    // Enviar respuesta exitosa con la información recopilada
    return { "cabecera": result[0], detalles: nuevosDetalles };
}

