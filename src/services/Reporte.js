const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode } = require('../tools/Tools');
const xl = require('excel4node');
const { sendSuccess, sendPdf, sendError } = require('../tools/Message');
const logger = require('../tools/Logger');
require('dotenv').config();
const axios = require('axios').default;
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Reporte {


    async facturacionPdfA4Cotizacion(req, res) { }

    async facturacionPdfTicketCotizacion(req, res) { }


    async facturacionPdfA4GuiRemision(req, res) { }

    async facturacionPdfTicketGuiaRemision(req, res) { }


    async tesoreriaPdfA4Compra(req, res) { }

    async tesoreriaPdfTicketCompra(req, res) { }

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

    async generarPdfFinanciero(req, res) {
        try {
            console.log(req.params.fechaInicio)
            console.log(req.params.fechaFinal)

            

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

    async generarExcelFinanciero(req, res) {
        try {
            console.log(req.params.fechaInicio)
            console.log(req.params.fechaFinal)

            const wb = new xl.Workbook();

            let ws = wb.addWorksheet('Hoja 1');

            const styleTitle = wb.createStyle({
                alignment: {
                    horizontal: 'center'
                },
                font: {
                    color: '#000000',
                    size: 12,
                },
            });

            const styleNameSucursal = wb.createStyle({
                alignment: {
                    horizontal: 'left'
                },
                font: {
                    color: '#000000',
                    size: 12,
                },
            });

            const styleHeader = wb.createStyle({
                alignment: {
                    horizontal: 'left'
                },
                font: {
                    color: '#000000',
                    size: 12,
                }
            });

            const styleTableHeader = wb.createStyle({
                alignment: {
                    horizontal: 'center'
                },
                font: {
                    bold: true,
                    color: '#000000',
                    size: 12,
                },

            });

            const styleBody = wb.createStyle({
                alignment: {
                    horizontal: 'left'
                },
                font: {
                    color: '#000000',
                    size: 12,
                }
            });

            const styleBodyInteger = wb.createStyle({
                alignment: {
                    horizontal: 'left'
                },
                font: {
                    color: '#000000',
                    size: 12,
                }
            });

            const styleBodyFloat = wb.createStyle({
                alignment: {
                    horizontal: 'left'
                },
                font: {
                    color: '#000000',
                    size: 12,
                },
                numberFormat: '#,##0.00; (#,##0.00); 0',
            });

            ws.column(1).setWidth(5);
            ws.column(2).setWidth(20);
            ws.column(3).setWidth(15);
            ws.column(4).setWidth(15);
            ws.column(5).setWidth(35);
            ws.column(6).setWidth(25);
            ws.column(7).setWidth(15);
            ws.column(8).setWidth(20);
            ws.column(9).setWidth(15);
            ws.column(10).setWidth(15);
            ws.column(11).setWidth(15);

            const data = await wb.writeToBuffer()

            res.end(data);
        } catch (error) {
            sendError(res, "Error al obtener el PDF")
        }
    }

    async generarFacturacionVenta(req, res, tipo) {
        try {
            const venta = await conec.query(`
            SELECT
                v.idVenta, 
                com.nombre AS comprobante,
                com.codigo as codigoVenta,
                v.serie,
                v.numeracion,
                v.idSucursal,
                v.codigoHash,
                td.nombre AS tipoDoc,      
                td.codigo AS codigoCliente,      
                c.documento,
                c.informacion,
                c.direccion,
                CONCAT(us.nombres,' ',us.apellidos) AS usuario,
                DATE_FORMAT(v.fecha,'%Y-%m-%d') as fecha,
                DATE_FORMAT(v.fecha,'%Y-%m-%d') as fechaQR,
                v.hora, 
                v.numeroCuota,
                v.frecuenciaPago,
                v.estado, 
                m.simbolo,
                m.codiso,
                m.nombre as moneda,
                p.nombre as formaPago
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
                v.idVenta = ?
            `, [
                req.params.idVenta
            ]);

            const detalle = await conec.query(`
            SELECT 
                p.nombre AS producto,
                md.nombre AS medida, 
                m.nombre AS categoria, 
                vd.precio,
                vd.cantidad,
                vd.idImpuesto,
                imp.nombre AS impuesto,
                imp.porcentaje
            FROM 
                ventaDetalle AS vd 
            INNER JOIN 
                producto AS p ON vd.idProducto = p.idProducto 
            INNER JOIN 
                medida AS md ON md.idMedida = p.idMedida 
            INNER JOIN 
                categoria AS m ON p.idCategoria = m.idCategoria 
            INNER JOIN 
                impuesto AS imp ON vd.idImpuesto  = imp.idImpuesto  
            WHERE 
                vd.idVenta = ?`, [
                req.params.idVenta
            ])

            const plazos = await conec.query(`
            SELECT 
                cuota,
                DATE_FORMAT(fecha,'%d/%m/%Y') as fecha,
                monto
            FROM 
                plazo 
            WHERE 
                idVenta = ?`, [
                req.params.idVenta
            ]);

            const bancos = await conec.query(`
            SELECT 
                nombre,
                numCuenta,
                cci
            FROM
                banco
            WHERE 
                reporte = 1
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
            LIMIT 
                1`);

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
                s.idSucursal = ?`, [
                venta[0].idSucursal
            ]);

            const newEmpresa = {
                ...empresa[0],
                "logoEmpresa": `${process.env.APP_URL}/files/company/${empresa[0].rutaLogo}`,
                "logoDesarrollador": `${process.env.APP_URL}/files/to/logo.png`,
            }

            const newventa = {
                ...venta[0],
                empresa: newEmpresa,
                sucursal: sucursal[0],
                ventaDetalle: detalle,
                plazos: plazos,
                bancos: bancos
            }

            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/api/v1/venta/${tipo}`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: newventa,
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            sendPdf(res, response.data);
        } catch (error) {
            logger.error(`Empresa/update: ${error.message ?? error}`)
            sendError(res, "Error al obtener el PDF")
        }
    }
}

module.exports = Reporte;