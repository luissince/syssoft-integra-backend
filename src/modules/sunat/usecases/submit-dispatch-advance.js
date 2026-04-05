
module.exports = ({ conec, axios }) => async function submitDispatchAdvance(data) {
    const { idGuiaRemision } = data;

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

    const guiaRemision = await conec.query(`
    SELECT 
        gui.idGuiaRemision,
        co.codigo,
        gui.serie,
        gui.numeracion,
        DATE_FORMAT(gui.fecha, '%Y-%m-%d') AS fecha,
        gui.hora,
        -- 
        ubp.ubigeo AS ubigeoPartida,
        gui.direccionPartida,
        -- 
        ubl.ubigeo AS ubigeoLlegada,
        gui.direccionLlegada,
        -- 
        mot.codigo AS codigoMotivoTraslado,
        mot.nombre AS nombreMotivoTraslado,
        -- 
        modt.codigo AS codigoModalidadTraslado,
        modt.nombre AS nombreModalidadTraslado,
        -- 
        tp.codigo AS codigoTipoPeso,
        tp.nombre AS nombreTipoPeso, 
        gui.peso,
        -- 
        DATE_FORMAT(gui.fechaTraslado,'%Y-%m-%d') AS fechaTraslado,
        -- 
        tdp.codigo AS codigoConductor,
        cod.documento AS documentoConductor,
        cod.informacion AS informacionConductor,
        cod.licenciaConducir,
        -- 
        vh.numeroPlaca,
        -- 
        cpv.codigo AS codigoComprobanteRef,
        cpv.nombre AS nombreComprobanteRef,
        vt.serie AS serieRef,
        vt.numeracion AS numeracionRef,
        -- 
        tdc.codigo AS codDestino,
        cl.documento AS documentoDestino,
        cl.informacion AS informacionDestino,
        -- 
        IFNULL(gui.numeroTicketSunat, '') AS numeroTicketSunat
    FROM 
        guiaRemision AS gui
    INNER JOIN 
        comprobante AS co ON co.idComprobante = gui.idComprobante
    INNER JOIN 
        ubigeo AS ubp ON ubp.idUbigeo = gui.idUbigeoPartida
    INNER JOIN 
        ubigeo AS ubl ON ubl.idUbigeo = gui.idUbigeoLlegada
    INNER JOIN 
        motivoTraslado AS mot ON mot.idMotivoTraslado = gui.idMotivoTraslado
    INNER JOIN 
        modalidadTraslado AS modt ON modt.idModalidadTraslado = gui.idModalidadTraslado
    INNER JOIN 
        tipoPeso AS tp ON tp.idTipoPeso = gui.idTipoPeso
    INNER JOIN 
        persona AS cod ON cod.idPersona = gui.idConductor
    INNER JOIN 
        tipoDocumento AS tdp ON tdp.idTipoDocumento = cod.idTipoDocumento
    INNER JOIN 
        vehiculo AS vh ON vh.idVehiculo = gui.idVehiculo
    INNER JOIN 
        venta AS vt ON vt.idVenta = gui.idVenta
    INNER JOIN 
        comprobante AS cpv ON cpv.idComprobante = vt.idComprobante
    INNER JOIN 
        persona AS cl ON cl.idPersona = vt.idCliente
    INNER JOIN 
        tipoDocumento AS tdc ON  tdc.idTipoDocumento = cl.idTipoDocumento
    WHERE 
        gui.idGuiaRemision = ?`, [
        idGuiaRemision
    ]);

    const detalles = await conec.query(`
    SELECT 
        p.idProducto,
        p.nombre,
        gd.cantidad,
        m.codigo codigoMedida
    FROM 
        guiaRemisionDetalle AS gd
    INNER JOIN 
        producto AS p ON gd.idProducto = p.idProducto
    INNER JOIN 
        medida AS m ON m.idMedida = p.idMedida
    WHERE 
        gd.idGuiaRemision = ?`, [
       idGuiaRemision
    ])

    const privateKeyBase64 = Buffer.from(empresa[0].privatePem).toString('base64');

    const flattenedPrivateKey = privateKeyBase64.replace(/\s+/g, '');

    const privateKey = Buffer.from(flattenedPrivateKey, 'base64').toString('utf-8');


    const publicKeyBase64 = Buffer.from(empresa[0].certificadoPem).toString('base64');

    const flattenedPublicKey = publicKeyBase64.replace(/\s+/g, '');

    const publicKey = Buffer.from(flattenedPublicKey, 'base64').toString('utf-8');


    const options = {
        method: 'POST',
        url: `${process.env.APP_CPE_SUNAT}/api/v1/guia/remision`,
        headers: {
            'Content-Type': 'application/json',
        },
        data: {
            "guiaRemision": guiaRemision[0],
            "empresa": empresa[0],
            "certificado": {
                "privateKey": privateKey,
                "publicKey": publicKey
            },
            "detalles": detalles
        },
    };

    const response = await axios.request(options);

    await conec.update(response.data.update, "guiaRemision", "idGuiaRemision", idGuiaRemision);

    delete response.data.update;

    return response.data;
}
