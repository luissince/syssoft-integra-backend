const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode } = require('../tools/Tools');
const { sendSuccess, sendPdf, sendError } = require('../tools/Message');

const { promisify } = require('util');
const fs = require("fs");
const path = require("path");
const readFileAsync = promisify(fs.readFile);

require('dotenv').config();
const axios = require('axios').default;
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Sunat {

    async facturar(req, res) {
        try {
            console.log(req.params.idVenta)


            // const certificateData = await readFileAsync(path.join(certificate, "certificate.pem"), 'utf8');

            // const certificateData = ``;


            // // console.log(certificateData)
            // let certificateDataJoin = certificateData.replace(/\n/g, '\\n');

            // if (!/\n$/.test(certificateData)) {
            //     certificateDataJoin += '\\n';
            // }

            // console.log(certificateDataJoin)

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
            WHERE vd.idVenta = ?
            `, [
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
                    "detalle": detalles
                },
            };

            const response = await axios.request(options);

            await conec.query(`
            UPDATE 
                venta
            SET 
                xmlSunat= ?,
                xmlDescripcion=?,
                codigoHash=?,
                xmlGenerado=?
            WHERE
                idVenta = ?`, [
                response.data.update.xmlSunat,
                response.data.update.xmlDescripcion,
                response.data.update.codigoHash,
                response.data.update.xmlGenerado,
                req.params.idVenta
            ]);

            delete response.data.update;

            sendPdf(res, response.data);
        } catch (error) {
            sendError(res, "Error en declarar el comprobante.")
        }
    }

    async anularBoleta(req, res) {
        try {
            console.log(req.params.idCotizacion)

            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/api/v1/cotizacion/a4/`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    serie: 'CT01',
                    numeracion: 1,
                    fecha: '2024-03-21',
                    hora: '17:20:22',
                    moneda: { nombre: 'SOLES', codiso: 'PEN' },
                    persona: {
                        documento: '00000000',
                        informacion: 'publica general',
                        direccion: 'av. las perras del solar'
                    },
                    comprobante: { nombre: 'COTIZACION' },
                    empresa: {
                        documento: '20547848307',
                        razonSocial: 'EMPRESA DE PRUEBA',
                        nombreEmpresa: 'syssoft',
                        logoEmpresa: `${process.env.APP_URL}/files/company/1710643112214_meehj7u.png`,
                        logoDesarrollador: `${process.env.APP_URL}/files/to/logo.png`,
                        tipoEnvio: true
                    },
                    sucursal: {
                        telefono: '064 78809',
                        celular: '99999992',
                        email: 'somoperu@gmail.com',
                        paginaWeb: 'www.mipagina.com',
                        direccion: 'AV. PROCERES DE LA INDEPENDEN NRO. 1775 INT. 307 URB. SAN HILARION LIMA LIMA SAN JUAN DE LURIGANCHO',
                        departamento: 'LIMA',
                        provincia: 'LIMA',
                        distrito: 'LINCE'
                    },
                    cotizacionDetalle: [
                        {
                            precio: 10,
                            cantidad: 2,
                            idImpuesto: 'IM0002',
                            producto: { nombre: 'producto a' },
                            medida: { nombre: 'UNIDAD' },
                            impuesto: { nombre: 'IGV(18%)', porcentaje: 18 }
                        },
                        {
                            precio: 10,
                            cantidad: 1,
                            idImpuesto: 'IM0002',
                            producto: { nombre: 'producto a' },
                            medida: { nombre: 'UNIDAD' },
                            impuesto: { nombre: 'IGV(18%)', porcentaje: 18 }
                        }
                    ],
                    bancos: [
                        { nombre: 'banco1', numCuenta: '22323232', cci: '232323233' },
                        { nombre: 'banco1', numCuenta: '22323232', cci: '232323233' }
                    ]
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            sendPdf(res, response.data);
        } catch (error) {
            sendError(res, "Error al obtener el PDF")
        }
    }

    async anularFactura(req, res) {
        try {
            console.log(req.params.idCotizacion)

            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/api/v1/cotizacion/a4/`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    serie: 'CT01',
                    numeracion: 1,
                    fecha: '2024-03-21',
                    hora: '17:20:22',
                    moneda: { nombre: 'SOLES', codiso: 'PEN' },
                    persona: {
                        documento: '00000000',
                        informacion: 'publica general',
                        direccion: 'av. las perras del solar'
                    },
                    comprobante: { nombre: 'COTIZACION' },
                    empresa: {
                        documento: '20547848307',
                        razonSocial: 'EMPRESA DE PRUEBA',
                        nombreEmpresa: 'syssoft',
                        logoEmpresa: `${process.env.APP_URL}/files/company/1710643112214_meehj7u.png`,
                        logoDesarrollador: `${process.env.APP_URL}/files/to/logo.png`,
                        tipoEnvio: true
                    },
                    sucursal: {
                        telefono: '064 78809',
                        celular: '99999992',
                        email: 'somoperu@gmail.com',
                        paginaWeb: 'www.mipagina.com',
                        direccion: 'AV. PROCERES DE LA INDEPENDEN NRO. 1775 INT. 307 URB. SAN HILARION LIMA LIMA SAN JUAN DE LURIGANCHO',
                        departamento: 'LIMA',
                        provincia: 'LIMA',
                        distrito: 'LINCE'
                    },
                    cotizacionDetalle: [
                        {
                            precio: 10,
                            cantidad: 2,
                            idImpuesto: 'IM0002',
                            producto: { nombre: 'producto a' },
                            medida: { nombre: 'UNIDAD' },
                            impuesto: { nombre: 'IGV(18%)', porcentaje: 18 }
                        },
                        {
                            precio: 10,
                            cantidad: 1,
                            idImpuesto: 'IM0002',
                            producto: { nombre: 'producto a' },
                            medida: { nombre: 'UNIDAD' },
                            impuesto: { nombre: 'IGV(18%)', porcentaje: 18 }
                        }
                    ],
                    bancos: [
                        { nombre: 'banco1', numCuenta: '22323232', cci: '232323233' },
                        { nombre: 'banco1', numCuenta: '22323232', cci: '232323233' }
                    ]
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            sendPdf(res, response.data);
        } catch (error) {
            sendError(res, "Error al obtener el PDF")
        }
    }

    async guiaRemision(req, res) {
        try {
            console.log(req.params.idCotizacion)

            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/api/v1/cotizacion/a4/`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    serie: 'CT01',
                    numeracion: 1,
                    fecha: '2024-03-21',
                    hora: '17:20:22',
                    moneda: { nombre: 'SOLES', codiso: 'PEN' },
                    persona: {
                        documento: '00000000',
                        informacion: 'publica general',
                        direccion: 'av. las perras del solar'
                    },
                    comprobante: { nombre: 'COTIZACION' },
                    empresa: {
                        documento: '20547848307',
                        razonSocial: 'EMPRESA DE PRUEBA',
                        nombreEmpresa: 'syssoft',
                        logoEmpresa: `${process.env.APP_URL}/files/company/1710643112214_meehj7u.png`,
                        logoDesarrollador: `${process.env.APP_URL}/files/to/logo.png`,
                        tipoEnvio: true
                    },
                    sucursal: {
                        telefono: '064 78809',
                        celular: '99999992',
                        email: 'somoperu@gmail.com',
                        paginaWeb: 'www.mipagina.com',
                        direccion: 'AV. PROCERES DE LA INDEPENDEN NRO. 1775 INT. 307 URB. SAN HILARION LIMA LIMA SAN JUAN DE LURIGANCHO',
                        departamento: 'LIMA',
                        provincia: 'LIMA',
                        distrito: 'LINCE'
                    },
                    cotizacionDetalle: [
                        {
                            precio: 10,
                            cantidad: 2,
                            idImpuesto: 'IM0002',
                            producto: { nombre: 'producto a' },
                            medida: { nombre: 'UNIDAD' },
                            impuesto: { nombre: 'IGV(18%)', porcentaje: 18 }
                        },
                        {
                            precio: 10,
                            cantidad: 1,
                            idImpuesto: 'IM0002',
                            producto: { nombre: 'producto a' },
                            medida: { nombre: 'UNIDAD' },
                            impuesto: { nombre: 'IGV(18%)', porcentaje: 18 }
                        }
                    ],
                    bancos: [
                        { nombre: 'banco1', numCuenta: '22323232', cci: '232323233' },
                        { nombre: 'banco1', numCuenta: '22323232', cci: '232323233' }
                    ]
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            sendPdf(res, response.data);
        } catch (error) {
            sendError(res, "Error al obtener el PDF")
        }
    }

    async consultar(req, res) {
        try {
            console.log(req.params.idCotizacion)

            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/api/v1/cotizacion/a4/`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    serie: 'CT01',
                    numeracion: 1,
                    fecha: '2024-03-21',
                    hora: '17:20:22',
                    moneda: { nombre: 'SOLES', codiso: 'PEN' },
                    persona: {
                        documento: '00000000',
                        informacion: 'publica general',
                        direccion: 'av. las perras del solar'
                    },
                    comprobante: { nombre: 'COTIZACION' },
                    empresa: {
                        documento: '20547848307',
                        razonSocial: 'EMPRESA DE PRUEBA',
                        nombreEmpresa: 'syssoft',
                        logoEmpresa: `${process.env.APP_URL}/files/company/1710643112214_meehj7u.png`,
                        logoDesarrollador: `${process.env.APP_URL}/files/to/logo.png`,
                        tipoEnvio: true
                    },
                    sucursal: {
                        telefono: '064 78809',
                        celular: '99999992',
                        email: 'somoperu@gmail.com',
                        paginaWeb: 'www.mipagina.com',
                        direccion: 'AV. PROCERES DE LA INDEPENDEN NRO. 1775 INT. 307 URB. SAN HILARION LIMA LIMA SAN JUAN DE LURIGANCHO',
                        departamento: 'LIMA',
                        provincia: 'LIMA',
                        distrito: 'LINCE'
                    },
                    cotizacionDetalle: [
                        {
                            precio: 10,
                            cantidad: 2,
                            idImpuesto: 'IM0002',
                            producto: { nombre: 'producto a' },
                            medida: { nombre: 'UNIDAD' },
                            impuesto: { nombre: 'IGV(18%)', porcentaje: 18 }
                        },
                        {
                            precio: 10,
                            cantidad: 1,
                            idImpuesto: 'IM0002',
                            producto: { nombre: 'producto a' },
                            medida: { nombre: 'UNIDAD' },
                            impuesto: { nombre: 'IGV(18%)', porcentaje: 18 }
                        }
                    ],
                    bancos: [
                        { nombre: 'banco1', numCuenta: '22323232', cci: '232323233' },
                        { nombre: 'banco1', numCuenta: '22323232', cci: '232323233' }
                    ]
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            sendPdf(res, response.data);
        } catch (error) {
            sendError(res, "Error al obtener el PDF")
        }
    }
    
}

module.exports = Sunat;