const { ClientError } = require("../../../tools/Error");

module.exports = ({ conec }) => async function getXml(data) {
    const { idComprobante } = data;

    const empresa = await conec.query(`
    SELECT 
        documento,
        razonSocial,
        nombreEmpresa
    FROM 
        empresa
    LIMIT 
        1`);

    const xml = await conec.query(`
    SELECT 
        v.xmlGenerado,
        co.nombre,
        v.serie,
        v.numeracion
    FROM 
        venta AS v 
    INNER JOIN 
        comprobante AS co ON v.idComprobante = co.idComprobante
    WHERE 
        v.idVenta = ?
        
    UNION
    
    SELECT 
        gu.xmlGenerado,
        co.nombre,
        gu.serie,
        gu.numeracion
    FROM 
        guiaRemision AS gu 
    INNER JOIN 
        comprobante AS co ON gu.idComprobante = co.idComprobante
    WHERE 
        gu.idGuiaRemision = ?`, [
        idComprobante,
        idComprobante,
    ]);

    if (xml.length === 0) {
        throw new ClientError("No hay información del comprobante.");   
    }

    if (xml[0].xmlGenerado === null || xml[0].xmlGenerado === "") {
        throw new ClientError("El comprobante no tiene generado ningún xml.");
    }

    const responde = {
        data: Buffer.from(xml[0].xmlGenerado, 'utf-8'),
        headers: {
            'content-type': 'application/xml',
            'content-disposition': `attachment; filename="${empresa[0].razonSocial} ${xml[0].nombre} ${xml[0].serie}-${xml[0].numeracion}.xml"`
        }
    }
    return responde;
}