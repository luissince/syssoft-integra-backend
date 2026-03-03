const { ClientError } = require("../../../tools/Error");

module.exports = ({ conec, axios }) => async function submitCreditNote(data) {
    const { idNotaCredito } = data;

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

    if (empresa.lenght === 0) {
        throw new ClientError("No se encontró la empresa.");
    }

    const notaCredito = await conec.query(`
    SELECT 
        nc.idNotaCredito,
        DATE_FORMAT(nc.fecha,'%Y-%m-%d') fecha,
        nc.hora,

        nc.idSucursal,

        co.codigo AS codigoComprobante,
        nc.serie,
        nc.numeracion,

        tc.codigo AS codigoTipoDocumento,
        pc.documento,
        pc.informacion,

        mt.codigo AS codigoMotivo,
        mt.nombre AS motivoAnulacion,

        m.codiso,
        m.nombre AS moneda,

        cv.codigo AS codigoComprobanteVenta,
        v.serie AS serieVenta,
        v.numeracion AS numeracionVenta

    FROM 
        notaCredito AS nc
    INNER JOIN
        comprobante AS co ON co.idComprobante = nc.idComprobante
    INNER JOIN
        persona AS pc ON pc.idPersona = nc.idCliente
    INNER JOIN
        tipoDocumento AS tc ON tc.idTipoDocumento = pc.idTipoDocumento
    INNER JOIN
        motivo AS mt ON mt.idMotivo = nc.idMotivo
    INNER JOIN
        moneda AS m ON m.idMoneda = nc.idMoneda 
    INNER JOIN
        venta AS v ON v.idVenta = nc.idVenta
    INNER JOIN
        comprobante AS cv on cv.idComprobante = v.idComprobante
    WHERE
        nc.idNotaCredito = ?`, [
        idNotaCredito
    ]);

    if (notaCredito.length === 0) {
        throw new ClientError("No se encontró la nota de crédito.");
    }

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
        notaCredito[0].idSucursal
    ]);

    if (sucursal.length === 0) {
        throw new ClientError("No se encontró la sucursal.");
    }

    const detalles = await conec.query(`
    SELECT 
        p.nombre AS producto,
        md.codigo AS codigoMedida,
        md.nombre AS medida, 
        m.nombre AS categoria, 
        ncd.precio,
        ncd.cantidad,
        ncd.idImpuesto,
        imp.nombre AS impuesto,
        imp.codigo,
        imp.porcentaje
    FROM notaCreditoDetalle AS ncd
    INNER JOIN 
        producto AS p ON ncd.idProducto = p.idProducto 
    INNER JOIN 
        medida AS md ON md.idMedida = p.idMedida 
    INNER JOIN 
        categoria AS m ON p.idCategoria = m.idCategoria 
    INNER JOIN 
        impuesto AS imp ON ncd.idImpuesto  = imp.idImpuesto
    WHERE
        ncd.idNotaCredito = ?`, [
        idNotaCredito
    ]);

    const privateKeyBase64 = Buffer.from(empresa[0].privatePem).toString('base64');

    const flattenedPrivateKey = privateKeyBase64.replace(/\s+/g, '');

    const privateKey = Buffer.from(flattenedPrivateKey, 'base64').toString('utf-8');


    const publicKeyBase64 = Buffer.from(empresa[0].certificadoPem).toString('base64');

    const flattenedPublicKey = publicKeyBase64.replace(/\s+/g, '');

    const publicKey = Buffer.from(flattenedPublicKey, 'base64').toString('utf-8');

    const options = {
        method: 'POST',
        url: `${process.env.APP_CPE_SUNAT}/api/v1/nota/credito`,
        headers: {
            'Content-Type': 'application/json',
        },
        data: {
            "notaCredito": notaCredito[0],
            "empresa": empresa[0],
            "sucursal": sucursal[0],
            "certificado": {
                "privateKey": privateKey,
                "publicKey": publicKey
            },
            "detalles": detalles
        },
    };

    const response = await axios.request(options);

    await conec.update(response.data.update, "notaCredito", "idNotaCredito", idNotaCredito);

    delete response.data.update;

    return response.data;
}
