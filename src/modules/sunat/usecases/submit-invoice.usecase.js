
module.exports = ({ conec, axios }) => async function submitInvoice(data) {
    const { idVenta } = data;

    const empresa = await conec.query(`
    SELECT 
        documento,
        tp.codigo,
        razonSocial,
        nombreEmpresa,
        usuarioSolSunat,
        claveSolSunat,
        certificadoPem,
        privatePem,
        idApiSunat,
        claveApiSunat,
        tipoEnvio
    FROM 
        empresa AS e
    INNER JOIN
        tipoDocumento AS tp ON tp.idTipoDocumento = e.idTipoDocumento
    LIMIT 1`);

    const venta = await conec.query(`
    SELECT
        v.idVenta, 
        DATE_FORMAT(v.fecha,'%Y-%m-%d') as fecha,
        v.hora,

        v.idSucursal,

        com.codigo as codigoComprobante,
        v.serie,
        v.numeracion,
          
        td.codigo AS codigoTipoDocumento,      
        c.documento,
        c.informacion,

        v.idFormaPago,

        DATE_FORMAT(v.fechaCorrelativo,'%Y-%m-%d') AS fechaCorrelativo,
        v.correlativo,
        v.ticketConsultaSunat,
        v.fechaVencimiento,

        m.codiso,
        m.nombre AS moneda
    FROM 
        venta AS v 
    INNER JOIN 
        persona AS c ON v.idCliente = c.idPersona
    INNER JOIN 
        tipoDocumento AS td ON td.idTipoDocumento = c.idTipoDocumento 
    INNER JOIN 
        comprobante AS com ON v.idComprobante = com.idComprobante
    INNER JOIN 
        moneda AS m ON m.idMoneda = v.idMoneda
    WHERE 
        v.idVenta = ?`, [
        idVenta
    ]);

    const sucursal = await conec.query(`
    SELECT 
        s.direccion,
        u.ubigeo,                
        u.departamento,
        u.provincia,
        u.distrito
    FROM 
        sucursal AS s
    INNER JOIN
        ubigeo AS u ON u.idUbigeo = s.idUbigeo
    WHERE
        s.idSucursal = ?`, [
        venta[0].idSucursal
    ]);

    const detalles = await conec.query(`
    SELECT 
        p.nombre AS producto,
        md.codigo AS codigoMedida,
        md.nombre AS medida, 
        m.nombre AS categoria, 
        vd.precio,
        vd.cantidad,
        vd.idImpuesto,
        imp.nombre AS impuesto,
        imp.codigo,
        imp.porcentaje
    FROM ventaDetalle AS vd 
    INNER JOIN 
        producto AS p ON vd.idProducto = p.idProducto 
    INNER JOIN 
        medida AS md ON md.idMedida = p.idMedida 
    INNER JOIN 
        categoria AS m ON p.idCategoria = m.idCategoria 
    INNER JOIN 
        impuesto AS imp ON vd.idImpuesto  = imp.idImpuesto  
    WHERE 
        vd.idVenta = ?`, [
        idVenta
    ]);

    const privateKeyBase64 = Buffer.from(empresa[0].privatePem).toString('base64');

    const flattenedPrivateKey = privateKeyBase64.replace(/\s+/g, '');

    const privateKey = Buffer.from(flattenedPrivateKey, 'base64').toString('utf-8');

    const publicKeyBase64 = Buffer.from(empresa[0].certificadoPem).toString('base64');

    const flattenedPublicKey = publicKeyBase64.replace(/\s+/g, '');

    const publicKey = Buffer.from(flattenedPublicKey, 'base64').toString('utf-8');

    const options = {
        method: 'POST',
        url: `${process.env.APP_CPE_SUNAT}/api/v1/facturar`,
        headers: {
            'Content-Type': 'application/json',
        },
        data: {
            "venta": venta[0],
            "empresa": empresa[0],
            "sucursal": sucursal[0],
            "certificado": {
                "privateKey": privateKey,
                "publicKey": publicKey
            },
            "detalles": detalles,
        },
    };

    const response = await axios.request(options);

    await conec.update(response.data.update, "venta", "idVenta", idVenta);

    delete response.data.update;

    return response.data;
}
