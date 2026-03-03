const { currentDate } = require('../../../tools/Tools');

module.exports = ({ conec, axios }) => async function voidReceiptCreditNote(data) {
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

    const notaCredito = await conec.query(`
    SELECT
        nc.idNotaCredito,
        DATE_FORMAT(nc.fecha,'%Y-%m-%d') as fecha,
        nc.hora,

        com.codigo as codigoComprobante,
        nc.serie,
        nc.numeracion,
    
        td.codigo AS codigoTipoDocumento,      
        c.documento,
        c.informacion,

        DATE_FORMAT(nc.fechaCorrelativo,'%Y-%m-%d') AS fechaCorrelativo,
        nc.correlativo,
        nc.ticketConsultaSunat,    

        m.codiso,
        m.nombre AS moneda
    FROM 
        notaCredito AS nc
    INNER JOIN 
        persona AS c ON c.idPersona = nc.idCliente
    INNER JOIN 
        tipoDocumento AS td ON td.idTipoDocumento = c.idTipoDocumento 
    INNER JOIN 
        comprobante AS com ON com.idComprobante = nc.idComprobante
    INNER JOIN 
        moneda AS m ON m.idMoneda = nc.idMoneda
    WHERE 
        nc.idNotaCredito = ?`, [
        idNotaCredito
    ])

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
    FROM 
        notaCreditoDetalle AS ncd
    INNER JOIN 
        producto AS p ON p.idProducto = ncd.idProducto
    INNER JOIN 
        medida AS md ON md.idMedida = p.idMedida 
    INNER JOIN 
        categoria AS m ON p.idCategoria = m.idCategoria 
    INNER JOIN 
        impuesto AS imp ON imp.idImpuesto = ncd.idImpuesto
    WHERE 
        ncd.idNotaCredito = ?`, [
        idNotaCredito
    ]);

    const correlativo = await conec.query(`
    SELECT 
        IFNULL(MAX(correlativo),0) AS valor 
    FROM 
        notaCredito 
    WHERE 
        fechaCorrelativo = ?`, [
        currentDate()
    ]);

    const privateKeyBase64 = Buffer.from(empresa[0].privatePem).toString('base64');

    const flattenedPrivateKey = privateKeyBase64.replace(/\s+/g, '');

    const privateKey = Buffer.from(flattenedPrivateKey, 'base64').toString('utf-8');


    const publicKeyBase64 = Buffer.from(empresa[0].certificadoPem).toString('base64');

    const flattenedPublicKey = publicKeyBase64.replace(/\s+/g, '');

    const publicKey = Buffer.from(flattenedPublicKey, 'base64').toString('utf-8');


    const options = {
        method: 'POST',
        url: `${process.env.APP_CPE_SUNAT}/api/v1/nota/credito/anular/boleta`,
        headers: {
            'Content-Type': 'application/json',
        },
        data: {
            "notaCredito": notaCredito[0],
            "empresa": empresa[0],
            "certificado": {
                "privateKey": privateKey,
                "publicKey": publicKey
            },
            "correlativoActual": correlativo[0].valor,
            "detalles": detalles
        },
    };

    const response = await axios.request(options);

    await conec.update(response.data.update, "notaCredito", "idNotaCredito", idNotaCredito);

    delete response.data.update;

    return response.data;
}
