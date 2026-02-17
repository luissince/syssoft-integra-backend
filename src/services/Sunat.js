const { currentDate } = require('../tools/Tools');
const { sendSuccess, sendError, sendFile, sendClient } = require('../tools/Message');
const firebaseService = require('../common/fire-base');

const { default: axios } = require('axios');
const conec = require('../database/mysql-connection');
const ErrorResponse = require('../tools/ErrorAxios');


class Sunat {

    async listCpeSunat(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_CPE_Sunat(?,?,?,?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idComprobante,
                parseInt(req.query.estado),
                req.query.idSucursal,

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_CPE_Sunat_Count(?,?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idComprobante,
                parseInt(req.query.estado),
                req.query.idSucursal
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/listCpeSunat", error);
        }
    }

    async facturar(req, res) {
        try {
            const venta = await conec.query(`
            SELECT
                v.idVenta, 
                com.nombre AS comprobante,
                com.codigo as codigoVenta,
                v.serie,
                v.numeracion,
                v.idSucursal,
                td.nombre AS tipoDoc,      
                td.codigo AS codigoCliente,      
                c.documento,
                c.informacion,
                c.direccion,
                pu.informacion AS usuario,
                DATE_FORMAT(v.fecha,'%Y-%m-%d') as fecha,
                v.hora,
                DATE_FORMAT(v.fechaCorrelativo,'%Y-%m-%d') AS fechaCorrelativo,
                v.correlativo,
                v.ticketConsultaSunat,
                v.idFormaPago,
                v.estado,
                m.simbolo,
                m.codiso,
                m.nombre AS moneda
            FROM 
                venta AS v 
            INNER JOIN 
                persona AS c ON v.idCliente = c.idPersona
            INNER JOIN 
                usuario AS us ON us.idUsuario = v.idUsuario 
            INNER JOIN
                persona AS pu ON pu.idPersona = us.idPersona
            INNER JOIN 
                tipoDocumento AS td ON td.idTipoDocumento = c.idTipoDocumento 
            INNER JOIN 
                comprobante AS com ON v.idComprobante = com.idComprobante
            INNER JOIN 
                moneda AS m ON m.idMoneda = v.idMoneda
            INNER JOIN 
                formaPago AS p ON p.idFormaPago = v.idFormaPago
            WHERE 
                v.idVenta = ?`, [
                req.params.idVenta
            ])

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
                INNER JOIN producto AS p ON vd.idProducto = p.idProducto 
                INNER JOIN medida AS md ON md.idMedida = p.idMedida 
                INNER JOIN categoria AS m ON p.idCategoria = m.idCategoria 
                INNER JOIN impuesto AS imp ON vd.idImpuesto  = imp.idImpuesto  
            WHERE vd.idVenta = ?`, [
                req.params.idVenta
            ]);

            const cuotas = await conec.query(`
            SELECT 
                cuota,
                DATE_FORMAT(fecha,'%Y-%m-%d') AS fecha,
                hora,
                monto
            FROM 
                cuota 
            WHERE 
                idVenta = ?`, [
                req.params.idVenta
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
                    "detalle": detalles,
                    "cuotas": cuotas
                },
            };

            const response = await axios.request(options);

            await conec.update(response.data.update, "venta", "idVenta", req.params.idVenta);

            delete response.data.update;

            sendSuccess(res, response.data);
        } catch (error) {
            console.log(error);
            const errorResponse = new ErrorResponse(error);
            sendError(res, errorResponse.getMessage(), "Sunat/factura", error)
        }
    }

    async anularBoleta(req, res) {
        try {
            const venta = await conec.query(`
            SELECT
                v.idVenta, 
                com.nombre AS comprobante,
                com.codigo as codigoVenta,
                v.serie,
                v.numeracion,
                v.idSucursal,
                td.nombre AS tipoDoc,      
                td.codigo AS codigoCliente,      
                c.documento,
                c.informacion,
                c.direccion,
                pu.informacion AS usuario,
                DATE_FORMAT(v.fecha,'%Y-%m-%d') as fecha,
                v.hora,
                DATE_FORMAT(v.fechaCorrelativo,'%Y-%m-%d') AS fechaCorrelativo,
                v.correlativo,
                v.ticketConsultaSunat,
                v.idFormaPago,
                v.estado,
                m.simbolo,
                m.codiso,
                m.nombre AS moneda
            FROM 
                venta AS v 
            INNER JOIN 
                persona AS c ON v.idCliente = c.idPersona
            INNER JOIN 
                usuario AS us ON us.idUsuario = v.idUsuario 
            INNER JOIN
                persona AS pu ON pu.idPersona = us.idPersona
            INNER JOIN 
                tipoDocumento AS td ON td.idTipoDocumento = c.idTipoDocumento 
            INNER JOIN 
                comprobante AS com ON v.idComprobante = com.idComprobante
            INNER JOIN 
                moneda AS m ON m.idMoneda = v.idMoneda
            INNER JOIN 
                formaPago AS p ON p.idFormaPago = v.idFormaPago
            WHERE 
                v.idVenta = ?`, [
                req.params.idVenta
            ])

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
                INNER JOIN producto AS p ON vd.idProducto = p.idProducto 
                INNER JOIN medida AS md ON md.idMedida = p.idMedida 
                INNER JOIN categoria AS m ON p.idCategoria = m.idCategoria 
                INNER JOIN impuesto AS imp ON vd.idImpuesto  = imp.idImpuesto  
            WHERE vd.idVenta = ?
            `, [
                req.params.idVenta
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
                url: `${process.env.APP_CPE_SUNAT}/api/v1/anular/boleta`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    "venta": venta[0],
                    "empresa": empresa[0],
                    "certificado": {
                        "privateKey": privateKey,
                        "publicKey": publicKey
                    },
                    "correlativoActual": correlativo[0].valor,
                    "detalle": detalles
                },
            };

            const response = await axios.request(options);

            await conec.update(response.data.update, "venta", "idVenta", req.params.idVenta);

            delete response.data.update;

            sendSuccess(res, response.data);
        } catch (error) {
            const errorResponse = new ErrorResponse(error);
            sendError(res, errorResponse.getMessage(), "Sunat/anularBoleta", error)
        }
    }

    async anularFactura(req, res) {
        try {
            const venta = await conec.query(`
            SELECT
                v.idVenta, 
                com.nombre AS comprobante,
                com.codigo as codigoVenta,
                v.serie,
                v.numeracion,
                v.idSucursal,
                td.nombre AS tipoDoc,      
                td.codigo AS codigoCliente,      
                c.documento,
                c.informacion,
                c.direccion,
                CONCAT(us.nombres,' ',us.apellidos) AS usuario,
                DATE_FORMAT(v.fecha,'%Y-%m-%d') as fecha,
                v.hora,
                DATE_FORMAT(v.fechaCorrelativo,'%Y-%m-%d') AS fechaCorrelativo,
                v.correlativo,
                v.ticketConsultaSunat,
                v.idFormaPago,
                v.estado,
                m.simbolo,
                m.codiso,
                m.nombre AS moneda
            FROM 
                venta AS v 
            INNER JOIN 
                persona AS c ON v.idCliente = c.idPersona
            INNER JOIN 
                usuario AS us ON us.idUsuario = v.idUsuario 
            INNER JOIN 
                tipoDocumento AS td ON td.idTipoDocumento = c.idTipoDocumento 
            INNER JOIN 
                comprobante AS com ON v.idComprobante = com.idComprobante
            INNER JOIN 
                moneda AS m ON m.idMoneda = v.idMoneda
            INNER JOIN 
                formaPago AS p ON p.idFormaPago = v.idFormaPago
            WHERE 
                v.idVenta = ?`, [
                req.params.idVenta
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

            await conec.update(response.data.update, "venta", "idVenta", req.params.idVenta);

            delete response.data.update;

            sendSuccess(res, response.data);
        } catch (error) {
            const errorResponse = new ErrorResponse(error);
            sendError(res, errorResponse.getMessage(), "Sunat/anularFactura", error)
        }
    }

    async guiaRemision(req, res) {
        try {

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
                req.params.idGuiaRemision
            ])

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

            const detalle = await conec.query(`
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
                req.params.idGuiaRemision
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
                    "detalle": detalle
                },
            };

            const response = await axios.request(options);

            await conec.update(response.data.update, "guiaRemision", "idGuiaRemision", req.params.idGuiaRemision);

            delete response.data.update;

            sendSuccess(res, response.data);
        } catch (error) {
            const errorResponse = new ErrorResponse(error);
            sendError(res, errorResponse.getMessage(), "Sunat/guiaRemision", error)
        }
    }

    async status(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_CPE_SUNAT}/api/v1/consultar`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    "ruc": req.params.ruc,
                    "usuarioSol": req.params.usuario,
                    "claveSol": req.params.clave,
                    "tipoComprobante": req.params.tipoComprobante,
                    "serie": req.params.serie,
                    "numeracion": req.params.numeracion,
                    "cdr": ""
                },
            };

            const response = await axios.request(options);

            sendSuccess(res, response.data);
        } catch (error) {
            const errorResponse = new ErrorResponse(error);
            sendError(res, errorResponse.getMessage(), "Sunat/consultar", error)
        }
    }

    async cdr(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_CPE_SUNAT}/api/v1/cdr`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    "ruc": req.params.ruc,
                    "usuarioSol": req.params.usuario,
                    "claveSol": req.params.clave,
                    "tipoComprobante": req.params.tipoComprobante,
                    "serie": req.params.serie,
                    "numeracion": req.params.numeracion,
                },
            };

            const response = await axios.request(options);
            sendSuccess(res, response.data);
        } catch (error) {
            const errorResponse = new ErrorResponse(error);
            sendError(res, errorResponse.getMessage(), "Sunat/consultar", error)
        }
    }

    async generarXmlSunat(req, res) {
        try {
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
                req.params.idComprobante,
                req.params.idComprobante,
            ]);

            if (xml.length === 0) {
                return sendClient(res, "No hay información del comprobante.");
            }

            if (xml[0].xmlGenerado === null || xml[0].xmlGenerado === "") {
                return sendClient(res, "El comprobante no tiene generado ningún xml.");
            }

            const responde = {
                data: Buffer.from(xml[0].xmlGenerado, 'utf-8'),
                headers: {
                    'content-type': 'application/xml',
                    'content-disposition': `attachment; filename="${empresa[0].razonSocial} ${xml[0].nombre} ${xml[0].serie}-${xml[0].numeracion}.xml"`
                }
            }
            sendFile(res, responde);
        } catch (error) {
            sendError(res, "Error al obtener el PDF", "Sunat/generarXmlSunat", error)
        }
    }

    async enviarEmail(req, res) {
        try {
            let responseInvoices;

            const outputType = "pdf";
            const size = "A4";

            const bucket = firebaseService.getBucket();

            const empresa = await conec.query(`
                SELECT
                    documento,
                    razonSocial,
                    nombreEmpresa,
                    rutaLogo,
                    tipoEnvio
                FROM 
                    empresa
                LIMIT 
                    1`);

            if (req.params.tipo === "fac") {
                const idVenta = req.params.idComprobante;

                const venta = await conec.query(`
                SELECT 
                    DATE_FORMAT(v.fecha, '%d/%m/%Y') AS fecha, 
                    v.hora,
                    v.idSucursal,
                    v.nota,
                    --
                    c.nombre AS comprobante,
                    v.serie,
                    v.numeracion,
                    c.facturado,
                    --
                    cp.documento,
                    cp.informacion,
                    cp.direccion,
                    --
                    fp.nombre AS formaPago,
                    pl.nombre AS plazo,
                    IFNULL(DATE_FORMAT(v.fechaVencimiento, '%d/%m/%Y') , '') AS fechaVencimiento,
                    --
                    m.nombre AS moneda,
                    m.simbolo,
                    m.codiso,
                    --
                    pu.informacion 
                FROM 
                    venta AS v
                INNER JOIN
                    comprobante AS c ON c.idComprobante = v.idComprobante
                INNER JOIN
                    persona AS cp ON cp.idPersona = v.idCliente
                INNER JOIN
                    moneda AS m ON m.idMoneda = v.idMoneda
                INNER JOIN
                    usuario AS u ON u.idUsuario = v.idUsuario
                INNER JOIN
                    persona AS pu ON pu.idPersona = u.idPersona
                INNER JOIN
                    formaPago AS fp ON fp.idFormaPago = v.idFormaPago
                LEFT JOIN
                    plazo as pl ON pl.idPlazo = v.idPlazo
                WHERE 
                    v.idVenta = ?`, [
                    idVenta
                ]);

                const sucursal = await conec.query(`
                SELECT 
                    s.nombre,
                    s.telefono,
                    s.celular,
                    s.email,
                    s.paginaWeb,
                    s.direccion,
    
                    ub.departamento,
                    ub.provincia,
                    ub.distrito
                FROM 
                    sucursal AS s
                INNER JOIN
                    ubigeo AS ub ON ub.idUbigeo = s.idUbigeo
                WHERE 
                    s.idSucursal = ?`, [
                    venta[0].idSucursal
                ]);

                const detalles = await conec.query(` 
                SELECT 
                    ROW_NUMBER() OVER (ORDER BY gd.idVentaDetalle ASC) AS id,
                    p.codigo,
                    p.nombre,
                    gd.cantidad,
                    gd.precio,
                    m.nombre AS medida,
                    i.idImpuesto,
                    i.nombre AS impuesto,
                    i.porcentaje
                FROM 
                    ventaDetalle AS gd
                INNER JOIN 
                    producto AS p ON gd.idProducto = p.idProducto
                INNER JOIN 
                    medida AS m ON m.idMedida = p.idMedida
                INNER JOIN
                    impuesto AS i ON i.idImpuesto = gd.idImpuesto
                WHERE 
                    gd.idVenta = ?
                ORDER BY 
                    gd.idVentaDetalle ASC`, [
                    idVenta
                ]);

                const bancos = await conec.query(`
                SELECT 
                    nombre,
                    numCuenta,
                    cci
                FROM
                    banco
                WHERE 
                    reporte = 1 AND idSucursal = ?`, [
                    venta[0].idSucursal
                ]);

                const body = {
                    "size": size,
                    "outputType": outputType,
                    "company": {
                        ...empresa[0],
                        rutaLogo: empresa[0].rutaLogo ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${empresa[0].rutaLogo}` : null,
                    },
                    "branch": {
                        "nombre": sucursal[0].nombre,
                        "telefono": sucursal[0].telefono,
                        "celular": sucursal[0].celular,
                        "email": sucursal[0].email,
                        "paginaWeb": sucursal[0].paginaWeb,
                        "direccion": sucursal[0].direccion,
                        "ubigeo": {
                            "departamento": sucursal[0].departamento,
                            "provincia": sucursal[0].provincia,
                            "distrito": sucursal[0].distrito
                        }
                    },
                    "sale": {
                        "fecha": venta[0].fecha,
                        "hora": venta[0].hora,
                        "nota": venta[0].nota,
                        "comprobante": {
                            "nombre": venta[0].comprobante,
                            "serie": venta[0].serie,
                            "numeracion": venta[0].numeracion,
                            "facturado": venta[0].facturado
                        },
                        "cliente": {
                            "documento": venta[0].documento,
                            "informacion": venta[0].informacion,
                            "direccion": venta[0].direccion
                        },
                        "formaPago": {
                            "nombre": venta[0].formaPago
                        },
                        "plazo": !venta[0].plazo ? null : {
                            "nombre": venta[0].plazo,
                        },
                        "fechaVencimiento": venta[0].fechaVencimiento,
                        "moneda": {
                            "nombre": venta[0].moneda,
                            "simbolo": venta[0].simbolo,
                            "codiso": venta[0].codiso
                        },
                        "usuario": {
                            "apellidos": venta[0].apellidos,
                            "nombres": venta[0].nombres
                        },
                        "ventaDetalles": detalles.map(item => {
                            return {
                                "id": item.id,
                                "cantidad": item.cantidad,
                                "precio": item.precio,
                                "producto": {
                                    "codigo": item.codigo,
                                    "nombre": item.nombre,
                                    "medida": {
                                        "nombre": item.medida,
                                    }
                                },
                                "impuesto": {
                                    "idImpuesto": item.idImpuesto,
                                    "nombre": item.impuesto,
                                    "porcentaje": item.porcentaje,
                                },

                            }
                        }),
                    },
                    "banks": bancos
                };

                const optionsInvoices = {
                    method: 'POST',
                    url: `${process.env.APP_PDF}/sale/pdf/invoices`,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    data: body,
                    responseType: 'arraybuffer'
                };

                responseInvoices = await axios.request(optionsInvoices);
            } else {
                const idGuiaRemision = req.params.idComprobante;

                const guiaRemision = await conec.query(`
                SELECT
                    DATE_FORMAT(gui.fecha,'%d/%m/%Y') AS fecha,
                    gui.hora,
                    gui.idSucursal,
                    --
                    cgui.nombre AS comprobante,
                    gui.serie,
                    gui.numeracion,
                    cgui.facturado,
                    --
                    mdt.nombre AS modalidadTraslado,
                    --
                    mvt.nombre AS motivoTraslado,
                    --
                    DATE_FORMAT(gui.fechaTraslado,'%d/%m/%Y') AS fechaTraslado,
                    --
                    tp.nombre AS tipoPeso,
                    --
                    gui.peso,
                    --
                    vh.marca,
                    vh.numeroPlaca,
                    --
                    cd.documento AS documentoConductor,
                    cd.informacion AS informacionConductor,
                    cd.licenciaConducir,
                    --
                    gui.direccionPartida,
                    --
                    up.departamento AS departamentoPartida,
                    up.provincia AS provinciaPartida,
                    up.distrito AS distritoPartida,
                    up.ubigeo AS ubigeoPartida,
                    --
                    gui.direccionLlegada,
                    --
                    ul.departamento AS departamentoLlegada,
                    ul.provincia AS provinciaLlegada,
                    ul.distrito AS distritoLlegada,
                    ul.ubigeo AS ubigeoLlegada,
                    --
                    pu.informacion,
                    --
                    v.serie AS serieRef,
                    v.numeracion AS numeracionRef,
                    cv.nombre AS comprobanteRef,
                    --
                    cl.documento AS documentoCliente,
                    cl.informacion AS informacionCliente,
                    --
                    gui.codigoHash
                FROM
                    guiaRemision AS gui
                INNER JOIN 
                    comprobante AS cgui on cgui.idComprobante = gui.idComprobante
                INNER JOIN 
                    modalidadTraslado AS mdt ON mdt.idModalidadTraslado = gui.idModalidadTraslado
                INNER JOIN 
                    motivoTraslado AS mvt ON mvt.idMotivoTraslado = gui.idMotivoTraslado
                INNER JOIN 
                    tipoPeso AS tp ON tp.idTipoPeso = gui.idTipoPeso
                INNER JOIN 
                    vehiculo AS vh ON vh.idVehiculo = gui.idVehiculo
                INNER JOIN 
                    persona AS cd ON cd.idPersona = gui.idConductor
                INNER JOIN 
                    ubigeo AS up ON up.idUbigeo = gui.idUbigeoPartida
                INNER JOIN 
                    ubigeo AS ul ON ul.idUbigeo = gui.idUbigeoLlegada
                INNER JOIN 
                    usuario AS u ON u.idUsuario = gui.idUsuario
                INNER JOIN
                    persona AS pu ON pu.idPersona = u.idPersona
                INNER JOIN 
                    venta AS v ON v.idVenta = gui.idVenta
                INNER JOIN 
                    comprobante AS cv on cv.idComprobante = v.idComprobante
                INNER JOIN 
                    persona AS cl ON cl.idPersona = v.idCliente
                WHERE 
                    gui.idGuiaRemision = ?`, [
                    idGuiaRemision
                ]);

                const sucursal = await conec.query(`
                SELECT 
                    s.nombre,
                    s.telefono,
                    s.celular,
                    s.email,
                    s.paginaWeb,
                    s.direccion,
    
                    ub.departamento,
                    ub.provincia,
                    ub.distrito
                FROM 
                    sucursal AS s
                INNER JOIN
                    ubigeo AS ub ON ub.idUbigeo = s.idUbigeo
                WHERE 
                    s.idSucursal = ?`, [
                    guiaRemision[0].idSucursal
                ]);

                const detalles = await conec.query(` 
                SELECT 
                    ROW_NUMBER() OVER (ORDER BY gd.idGuiaRemisionDetalle ASC) AS id,
                    p.codigo,
                    p.nombre AS producto,
                    gd.cantidad,
                    m.nombre AS medida 
                FROM 
                    guiaRemisionDetalle AS gd
                INNER JOIN 
                    producto AS p ON gd.idProducto = p.idProducto
                INNER JOIN 
                    medida AS m ON m.idMedida = p.idMedida
                WHERE 
                    gd.idGuiaRemision = ?
                ORDER BY 
                    gd.idGuiaRemisionDetalle ASC`, [
                    idGuiaRemision
                ]);

                const body = {
                    "size": size,
                    "outputType": outputType,
                    "company": {
                        ...empresa[0],
                        rutaLogo: empresa[0].rutaLogo ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${empresa[0].rutaLogo}` : null,
                    },
                    "branch": {
                        "nombre": sucursal[0].nombre,
                        "telefono": sucursal[0].telefono,
                        "celular": sucursal[0].celular,
                        "email": sucursal[0].email,
                        "paginaWeb": sucursal[0].paginaWeb,
                        "direccion": sucursal[0].direccion,
                        "ubigeo": {
                            "departamento": sucursal[0].departamento,
                            "provincia": sucursal[0].provincia,
                            "distrito": sucursal[0].distrito
                        }
                    },
                    "dispatchGuide": {
                        "fecha": guiaRemision[0].fecha,
                        "hora": guiaRemision[0].hora,
                        "comprobante": {
                            "nombre": guiaRemision[0].comprobante,
                            "serie": guiaRemision[0].serie,
                            "numeracion": guiaRemision[0].numeracion,
                            "facturado": guiaRemision[0].facturado
                        },
                        "modalidadTraslado": {
                            "nombre": guiaRemision[0].modalidadTraslado
                        },
                        "motivoTraslado": {
                            "nombre": guiaRemision[0].motivoTraslado
                        },
                        "fechaTraslado": guiaRemision[0].fechaTraslado,
                        "tipoPeso": {
                            "nombre": guiaRemision[0].tipoPeso,
                        },
                        "peso": guiaRemision[0].peso,
                        "vehiculo": {
                            "marca": guiaRemision[0].marca,
                            "numeroPlaca": guiaRemision[0].numeroPlaca,
                        },
                        "conductor": {
                            "documento": guiaRemision[0].documentoConductor,
                            "informacion": guiaRemision[0].informacionConductor,
                            "licenciaConducir": guiaRemision[0].licenciaConducir
                        },
                        "direccionPartida": guiaRemision[0].direccionPartida,
                        "ubigeoPartida": {
                            "departamento": guiaRemision[0].departamentoPartida,
                            "provincia": guiaRemision[0].provinciaPartida,
                            "distrito": guiaRemision[0].distritoPartida,
                            "ubigeo": guiaRemision[0].ubigeoPartida,
                        },
                        "direccionLlegada": guiaRemision[0].direccionLlegada,
                        "ubigeoLlegada": {
                            "departamento": guiaRemision[0].departamentoLlegada,
                            "provincia": guiaRemision[0].provinciaLlegada,
                            "distrito": guiaRemision[0].distritoLlegada,
                            "ubigeo": guiaRemision[0].ubigeoLlegada,
                        },
                        "usuario": {
                            "informacion": guiaRemision[0].informacion,
                        },
                        "venta": {
                            "comprobante": {
                                "nombre": guiaRemision[0].comprobanteRef,
                                "serie": guiaRemision[0].serieRef,
                                "numeracion": guiaRemision[0].numeracionRef,
                            },
                            "cliente": {
                                "documento": guiaRemision[0].documentoCliente,
                                "informacion": guiaRemision[0].informacionCliente,
                            }
                        },
                        "codigoHash": guiaRemision[0].codigoHash,
                        "guiaRemisionDetalles": detalles.map(item => {
                            return {
                                "id": item.id,
                                "cantidad": item.cantidad,
                                "producto": {
                                    "codigo": item.codigo,
                                    "nombre": item.producto,
                                    "medida": {
                                        "nombre": item.medida,
                                    },
                                },
                            }
                        }),
                    },
                };

                const optionsInvoices = {
                    method: 'POST',
                    url: `${process.env.APP_PDF}/dispatch-guide/pdf/invoices`,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    data: body,
                    responseType: 'arraybuffer'
                };

                responseInvoices = await axios.request(optionsInvoices);
            }

            const xml = await conec.query(`
                SELECT 
                    v.xmlGenerado,
                    co.nombre,
                    v.serie,
                    v.numeracion,
                    DATE_FORMAT(v.fecha, '%d/%m/%Y') AS fecha,
                    cn.documento, 
                    cn.informacion,
                    cn.email
                FROM 
                    venta AS v 
                INNER JOIN 
                    comprobante AS co ON v.idComprobante = co.idComprobante
                INNER JOIN
                    persona AS cn ON v.idCliente = cn.idPersona
                WHERE 
                    v.idVenta = ?
        
                UNION
                
                SELECT 
                    gu.xmlGenerado,
                    co.nombre,
                    gu.serie,
                    gu.numeracion,
                    DATE_FORMAT(gu.fecha, '%d/%m/%Y') AS fecha,
                    cn.documento, 
                    cn.informacion,
                    cn.email
                FROM 
                    guiaRemision AS gu 
                INNER JOIN 
                    comprobante AS co ON gu.idComprobante = co.idComprobante
                INNER JOIN 
                    venta AS v ON v.idVenta = gu.idVenta
                INNER JOIN 
                    persona AS cn ON v.idCliente = cn.idPersona
                WHERE 
                    gu.idGuiaRemision = ?`, [
                req.params.idComprobante,
                req.params.idComprobante,
            ]);

            if (xml.length === 0) {
                return sendClient(res, "No hay información del comprobante.");
            }

            if (xml[0].xmlGenerado === null || xml[0].xmlGenerado === "") {
                return sendClient(res, "El comprobante no tiene generado ningún xml.");
            }

            if (xml[0].email === null || xml[0].email === "") {
                return sendClient(res, "El cliente no tiene configurado un email.");
            }

            if (empresa[0].email === null || empresa[0].email === "") {
                return sendClient(res, "No se ha configurado el email de envío.");
            }

            const options = {
                method: 'POST',
                url: `${process.env.APP_EMAIL}/send`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    from: {
                        name: empresa[0].nombreEmpresa ?? empresa[0].razonSocial,
                        address: empresa[0].email
                    },
                    // to: xml[0].email,
                    to: {
                        address: xml[0].email,
                        name: empresa[0].razonSocial
                    },
                    subject: "Comprobante Electrónico",
                    html: `
                        <p>Estimado Cliente <b>${xml[0].informacion}</b>.</p>
                        <p>Le envíamos la información de su comprobante electrónico.</p>
                        <span>N° RUC del Emisor: <b>${empresa[0].documento}</b></span><br/>
                        <span>Tipo de Comprobante: <b>${xml[0].nombre}</b></span><br/>
                        <span>Serie del Comprobante: <b>${xml[0].serie}</b></span><br/>
                        <span>Número del Comprobante : <b>${xml[0].numeracion}</b></span><br/>
                        <span>N° RUC/DNI del Cliente: <b>${xml[0].documento}</b></span><br/>
                        <span>Fecha de Emisión: <b>${xml[0].fecha}</b></span><br/>
                        <p>Atentamente ,</p>
                        `,
                    attachments: [
                        {
                            filename: `${empresa[0].razonSocial} ${xml[0].nombre} ${xml[0].serie}-${xml[0].numeracion}.xml`,
                            content: xml[0].xmlGenerado,
                            contentType: 'application/xml'
                        },
                        {
                            filename: `${empresa[0].razonSocial} ${xml[0].nombre} ${xml[0].serie}-${xml[0].numeracion}.pdf`,
                            content: responseInvoices.data,
                            contentType: 'application/pdf'
                        }
                    ],
                },
            };

            const response = await axios.request(options);
            sendSuccess(res, response.data);
        } catch (error) {
            const errorResponse = new ErrorResponse(error);
            sendError(res, errorResponse.getMessage(), "Sunat/consultar", error)
        }
    }

    async dashboard(req, res) {
        try {
            const result = await conec.procedureAll(`CALL Dashboard_CPESunat(?,?,?)`, [
                req.query.month,
                req.query.year,
                req.query.idSucursal,
            ]);

            return sendSuccess(res, {
                "ventas": result[0] ?? [],
                "ventasCompras": result[1] ?? [],
            });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Sunat/dashboard", error);
        }
    }

}

module.exports = Sunat;