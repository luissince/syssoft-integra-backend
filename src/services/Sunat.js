const { currentDate } = require('../tools/Tools');
const { sendSuccess, sendError, sendFile, sendClient } = require('../tools/Message');
const Factura = require('./Factura');
const GuiaRemision = require('./GuiaRemision');
const { default: axios } = require('axios');
const Conexion = require('../database/Conexion');
const ErrorResponse = require('../tools/ErrorAxios');

const conec = new Conexion();
const factura = new Factura();
const guiaRemision = new GuiaRemision();

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

            if (req.params.tipo === "fac") {
                const params = {
                    idVenta: req.params.idComprobante,
                    size: "A4"
                }

                const data = await factura.documentsPdfInvoices({
                    params: params
                });

                const optionsInvoices = {
                    method: 'POST',
                    url: `${process.env.APP_PDF}/sale/pdf/invoices`,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    data: data,
                    responseType: 'arraybuffer'
                };

                responseInvoices = await axios.request(optionsInvoices);
            } else {
                const params = {
                    idGuiaRemision: req.params.idComprobante,
                    size: "A4"
                }

                const data = await guiaRemision.documentsPdfInvoices({
                    params: params
                });

                const optionsInvoices = {
                    method: 'POST',
                    url: `${process.env.APP_PDF}/dispatch-guide/pdf/invoices`,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    data: data,
                    responseType: 'arraybuffer'
                };

                responseInvoices = await axios.request(optionsInvoices);
            }

            const empresa = await conec.query(`
                SELECT 
                    documento,
                    razonSocial,
                    nombreEmpresa,
                    email
                FROM 
                    empresa
                LIMIT 
                    1`);

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