
const { currentDate } = require('../../../tools/Tools');

module.exports = ({ conec, axios }) => async function voidInvoice(data) {
    const {idVenta} = data;

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
        
        com.codigo as codigoComprobante,
        v.serie,
        v.numeracion,
   
        td.codigo AS codigoTipoDocumento,      
        c.documento,
        c.informacion,

        DATE_FORMAT(v.fechaCorrelativo,'%Y-%m-%d') AS fechaCorrelativo,
        v.correlativo,
        v.ticketConsultaSunat,    

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

    const correlativo = await conec.query(`
    SELECT 
        IFNULL(MAX(correlativo),0) AS valor 
    FROM 
        venta 
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
        url: `${process.env.APP_CPE_SUNAT}/api/v1/anular/factura`,
        headers: {
            'Content-Type': 'application/json',
        },
        data: {
            "venta": venta[0],
            "empresa": empresa[0],
            "correlativoActual": correlativo[0].valor,
            "certificado": {
                "privateKey": privateKey,
                "publicKey": publicKey
            }
        },
    };

    const response = await axios.request(options);

    await conec.update(response.data.update, "venta", "idVenta", idVenta);

    delete response.data.update;

    return response.data;
}
