const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode } = require('../tools/Tools');
const { sendSuccess, sendPdf, sendError } = require('../tools/Message');
require('dotenv').config();
const axios = require('axios').default;
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Reporte {
    async reportPdfVenta(req, res) {
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

    async reportExcelVenta(req, res) {
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

    async reportPdfFinanciero(req, res) {
        try {
            console.log(req.params)

            const conceptos = await conec.query(`
            SELECT 
                -- 
                CASE 
                    WHEN c.idVenta IS NOT NULL THEN 'VENTA'
                    ELSE 'COBRO'
                END AS concepto,
                --
                COUNT(*) AS cantidad,
                -- 
                CASE 
                    WHEN c.idVenta IS NOT NULL THEN moc.codiso
                    ELSE  mog.codiso
                END AS codiso,
                SUM(i.monto) AS ingreso,
                0 AS salida
            FROM ingreso AS i
            -- 
            LEFT JOIN venta AS c ON c.idVenta = i.idVenta
            LEFT JOIN moneda AS moc ON moc.idMoneda = c.idMoneda
            -- 
            LEFT JOIN cobro AS g ON g.idCobro = i.idCobro
            LEFT JOIN moneda AS mog ON mog.idMoneda = g.idMoneda      
            GROUP BY 
                concepto
            --
            UNION
            --
            SELECT 
                --
                CASE 
                    WHEN c.idCompra IS NOT NULL THEN 'COMPRA'
                    ELSE 'GASTO'
                END AS concepto,
                --
                COUNT(*) AS cantidad,
                --
                CASE 
                    WHEN c.idCompra IS NOT NULL THEN moc.codiso
                    ELSE  mog.codiso
                END AS codiso,
                0 as ingreso,
                SUM(-s.monto) AS salida
            FROM salida AS s
            LEFT JOIN compra AS c ON c.idCompra = s.idCompra
            LEFT JOIN moneda AS moc ON moc.idMoneda = c.idMoneda
            --
            LEFT JOIN gasto AS g ON g.idGasto = s.idGasto
            LEFT JOIN moneda AS mog ON mog.idMoneda = g.idMoneda    
            GROUP BY 
                concepto`);

            const resumenes = await conec.query(`
            SELECT 
                b.nombre,
                SUM(CASE 
                    WHEN bd.tipo = 1 THEN bd.monto  
                    ELSE -bd.monto
                END) AS monto
            FROM 
                banco as b 
            INNER JOIN 
                bancoDetalle as bd on b.idBanco = bd.idBanco      
            GROUP BY 
                b.idBanco
            `);


            const empresa = await conec.query(`
            SELECT 
                documento,
                razonSocial,
                nombreEmpresa,
                rutaLogo,
                tipoEnvio
            FROM 
                empresa
            LIMIT 1`);

            const sucursal = await conec.query(`
            SELECT 
                s.telefono,
                s.celular,
                s.email,
                s.paginaWeb,
                s.direccion,
                u.departamento,
                u.provincia,
                u.distrito
            FROM 
                sucursal AS s
            INNER JOIN
                ubigeo AS u ON u.idUbigeo = s.idUbigeo
            WHERE
                s.idSucursal = 'SC0001'
            `);

            const newEmpresa = {
                ...empresa[0],
                "logoEmpresa": `${process.env.APP_URL}/files/company/${empresa[0].rutaLogo}`,
                "logoDesarrollador": `${process.env.APP_URL}/files/to/logo.png`,
            }

            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/api/v1/finanzas/`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    "fechaInicio": "2024-03-24",
                    "fechaFinal": "2024-03-24",
                    "empresa": newEmpresa,
                    "sucursal": sucursal[0],
                    "conceptos": conceptos,
                    "resumenes": resumenes

                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            sendPdf(res, response.data);
        } catch (error) {
            sendError(res, "Error al obtener el PDF")
        }
    }
    async reportExcelFinanciero(req, res) {
        try {
            console.log(req.params)

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

module.exports = Reporte;