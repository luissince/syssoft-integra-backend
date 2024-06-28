const { sendSuccess, sendError } = require('../tools/Message');
const { currentDate } = require('../tools/Tools');

require('dotenv').config();
const axios = require('axios').default;
const Conexion = require('../database/Conexion');
const ErrorResponse = require('../tools/ErrorAxios');
const conec = new Conexion();

class Sunat {

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

            const plazos = await conec.query(`
            SELECT 
                cuota,
                DATE_FORMAT(fecha,'%Y-%m-%d') AS fecha,
                hora,
                monto
            FROM 
                plazo 
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
                    "plazos": plazos
                },
            };

            const response = await axios.request(options);


            await conec.update(response.data.update, "venta", "idVenta", req.params.idVenta);

            delete response.data.update;

            sendSuccess(res, response.data);
        } catch (error) {
            const errorResponse = new ErrorResponse(error);
            sendError(res, errorResponse.getMessage(),"Sunat/factura", error)
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
            sendError(res, errorResponse.getMessage(),"Sunat/anularBoleta", error)
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
            sendError(res, errorResponse.getMessage(),"Sunat/anularFactura", error)
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
            sendError(res, errorResponse.getMessage(),"Sunat/guiaRemision", error)
        }
    }

    async consultar(req, res) {
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
            sendError(res, errorResponse.getMessage(),"Sunat/consultar", error)
        }
    }

}

module.exports = Sunat;