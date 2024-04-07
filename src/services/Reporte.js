const { dateFormat } = require('../tools/Tools');
const xl = require('excel4node');
const { sendPdf, sendError } = require('../tools/Message');
const logger = require('../tools/Logger');
require('dotenv').config();
const axios = require('axios').default;
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Reporte {

    async generarFacturacion(req, res, tipo) {
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
                v.idFormaPago,
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
                DATE_FORMAT(fecha,'%Y-%m-%d') as fecha,
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

            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/api/v1/venta/${tipo}`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    cabecera: venta[0],
                    empresa: newEmpresa,
                    sucursal: sucursal[0],
                    ventaDetalle: detalle,
                    plazos: plazos,
                    bancos: bancos
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            sendPdf(res, response.data);
        } catch (error) {
            logger.error(`Empresa/update: ${error.message ?? error}`)
            sendError(res, "Error al obtener el PDF")
        }
    }

    async generarCotizacion(req, res, tipo) {

    }

    async generarGuiaRemision(req, res, tipo) {

    }

    async generarCompra(req, res, tipo) {

    }

    async reportPdfVenta(req, res) {
        try {
            const fechaInicio = req.params.fechaInicio;
            const fechaFinal = req.params.fechaFinal;
            const idComprobante = req.params.idComprobante === "-" ? "" : req.params.idComprobante;
            const idSucursal = req.params.idSucursal === "-" ? "" : req.params.idSucursal;
            const idUsuario = req.params.idUsuario === "-" ? "" : req.params.idUsuario;

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

            const newEmpresa = {
                ...empresa[0],
                "logoEmpresa": `${process.env.APP_URL}/files/company/${empresa[0].rutaLogo}`,
                "logoDesarrollador": `${process.env.APP_URL}/files/to/logo.png`,
            }

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
                req.params.idSucursalGenerado
            ]);

            const ventas = await conec.procedure(`CALL Obtener_Venta_Reporte(?,?,?,?,?)`, [
                fechaInicio,
                fechaFinal,
                idComprobante,
                idSucursal,
                idUsuario,
            ])

            let comprobante = null;

            if (idComprobante !== "") {
                comprobante = await conec.query(`
                SELECT 
                    nombre
                FROM 
                    comprobante
                WHERE
                    idComprobante = ?`, [
                    idComprobante
                ])
            }

            let sucursalFiltro = null;

            if (idSucursal !== "") {
                sucursalFiltro = await conec.query(`
                SELECT 
                    nombre
                FROM 
                    sucursal
                WHERE
                    idSucursal = ?`, [
                    idSucursal
                ]);
            }

            let usuario = null;

            if (idUsuario !== "") {
                usuario = await conec.query(`
                SELECT 
                    p.descripcion AS rol,
                    u.apellidos,
                    u.nombres
                FROM 
                    usuario AS u
                INNER JOIN 
                    perfil AS p ON u.idPerfil = p.idPerfil
                WHERE 
                    u.idUsuario = ?`, [
                    idUsuario
                ]);
            }

            const cabecera = {
                "fechaInicio": fechaInicio,
                "fechaFinal": fechaFinal,
                "comprobante": idComprobante === "" ? "TODOS" : comprobante[0].nombre,
                "sucursal": idSucursal === "" ? "TODOS" : sucursalFiltro[0].nombre,
                "rol": idUsuario === "" ? "-" : usuario[0].rol,
                "usuario": idUsuario == "" ? "TODOS" : usuario[0].apellidos + ", " + usuario[0].nombres
            }

            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/api/v1/venta/reporte/a4`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    "cabecera": cabecera,
                    "empresa": newEmpresa,
                    "sucursal": sucursal[0],
                    "detalles": ventas
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
            const fechaInicio = req.params.fechaInicio;
            const fechaFinal = req.params.fechaFinal;
            const idComprobante = req.params.idComprobante === "-" ? "" : req.params.idComprobante;
            const idSucursal = req.params.idSucursal === "-" ? "" : req.params.idSucursal;
            const idUsuario = req.params.idUsuario === "-" ? "" : req.params.idUsuario;

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
                req.params.idSucursalGenerado
            ]);

            const ventas = await conec.procedure(`CALL Obtener_Venta_Reporte(?,?,?,?,?)`, [
                fechaInicio,
                fechaFinal,
                idComprobante,
                idSucursal,
                idUsuario,
            ])

            let comprobante = null;

            if (idComprobante !== "") {
                comprobante = await conec.query(`
                SELECT 
                    nombre
                FROM 
                    comprobante
                WHERE
                    idComprobante = ?`, [
                    idComprobante
                ])
            }

            let sucursalFiltro = null;

            if (idSucursal !== "") {
                sucursalFiltro = await conec.query(`
                SELECT 
                    nombre
                FROM 
                    sucursal
                WHERE
                    idSucursal = ?`, [
                    idSucursal
                ]);
            }

            let usuario = null;

            if (idUsuario !== "") {
                usuario = await conec.query(`
                SELECT 
                    p.descripcion AS rol,
                    u.apellidos,
                    u.nombres
                FROM 
                    usuario AS u
                INNER JOIN 
                    perfil AS p ON u.idPerfil = p.idPerfil
                WHERE 
                    u.idUsuario = ?`, [
                    idUsuario
                ]);
            }

            const cabecera = {
                "fechaInicio": fechaInicio,
                "fechaFinal": fechaFinal,
                "comprobante": idComprobante === "" ? "TODOS" : comprobante[0].nombre,
                "sucursal": idSucursal === "" ? "TODOS" : sucursalFiltro[0].nombre,
                "rol": idUsuario === "" ? "-" : usuario[0].rol,
                "usuario": idUsuario == "" ? "TODOS" : usuario[0].apellidos + ", " + usuario[0].nombres
            }

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

            ws.column(1).setWidth(10);
            ws.column(2).setWidth(20);
            ws.column(3).setWidth(20);
            ws.column(4).setWidth(20);
            ws.column(5).setWidth(15);
            ws.column(6).setWidth(15);
            ws.column(7).setWidth(15);
            ws.column(8).setWidth(20);
            ws.column(9).setWidth(15);
            ws.column(10).setWidth(15);

            // Cabecera
            ws.cell(1, 1, 1, 11, true).string(`${empresa[0].razonSocial}`).style(styleTitle);
            ws.cell(2, 1, 2, 11, true).string(`RUC: ${empresa[0].razonSocial}`).style(styleTitle);
            ws.cell(3, 1, 3, 11, true).string(`${sucursal[0].direccion}`).style(styleTitle);
            ws.cell(4, 1, 4, 11, true).string(`Celular: ${sucursal[0].celular} / Telefono: ${sucursal[0].telefono}`).style(styleTitle);

            // Filtros           
            ws.cell(6, 1, 6, 11, true).string(`REPORTE DE VENTAS`).style(styleTitle);
            ws.cell(7, 1, 7, 11, true).string(`PERIODO: ${dateFormat(fechaInicio)} al ${dateFormat(fechaFinal)}`).style(styleTitle);

            ws.cell(9, 1).string(`Comprobante(s):`).style(styleHeader);
            ws.cell(9, 2).string(`${cabecera.comprobante}`).style(styleHeader);

            ws.cell(10, 1).string(`Vendedor(s):`).style(styleHeader);
            ws.cell(10, 2).string(`${cabecera.usuario}`).style(styleHeader);

            ws.cell(11, 1).string(`Sucursal(s):`).style(styleHeader);
            ws.cell(11, 2).string(`${cabecera.sucursal}`).style(styleHeader);

            const header = ["N°", "N° DOCUMENTO", "CLIENTE", "COMPROBANTE", "SERIE", "NUMERACION", "FECHA", "FORMA DE PAGO", "ESTADO", "MONTO"];

            header.map((item, index) => ws.cell(13, 1 + index).string(item).style(styleTableHeader));

            ventas.map((item, index) => {
                let formaPago = "";
                if (item.idFormaPago === "FP0001") {
                    formaPago = "CONTADO";
                } else {
                    formaPago = "CRÉDITO";
                }

                let estado = "";
                if (item.estado === 1) {
                    estado = "COBRADO";
                } else if (item.estado === 2) {
                    estado = "POR COBRAR";
                } else if (item.estado === 3) {
                    estado = "ANULADO";
                } else {
                    estado = "POR LLEVAR";
                }

                ws.cell(14 + index, 1).number(parseInt(index + 1)).style(styleBodyInteger)
                ws.cell(14 + index, 2).string(item.documento).style(styleBody)
                ws.cell(14 + index, 3).string(item.cliente).style(styleBody)
                ws.cell(14 + index, 4).string(item.comprobante).style(styleBody)
                ws.cell(14 + index, 5).string(item.serie).style(styleBody)
                ws.cell(14 + index, 6).number(item.numeracion).style(styleBodyInteger)
                ws.cell(14 + index, 7).string(dateFormat(item.fecha)).style(styleBody)
                ws.cell(14 + index, 8).string(formaPago).style(styleBody)
                ws.cell(14 + index, 9).string(estado).style(styleBody)
                ws.cell(14 + index, 10).number(parseInt(item.monto)).style(styleBodyFloat)
            })

            // data.map((item, index) => {

            // ws.cell(14 + index, 1).number(parseInt(index + 1)).style(styleBodyInteger)
            // ws.cell(14 + index, 2).string(item.fecha).style(styleBody)
            // ws.cell(14 + index, 3).number(parseInt(item.documento)).style(styleBodyInteger)
            // ws.cell(14 + index, 4).string(item.informacion).style(styleBody)
            // ws.cell(14 + index, 5).string(item.comprobante).style(styleBody)
            // ws.cell(14 + index, 6).string(item.serie + "-" + item.numeracion).style(styleBody)
            // ws.cell(14 + index, 7).string(item.producto + " - " + item.categoria).style(styleBody)
            // ws.cell(14 + index, 8).string(item.tipo).style(styleBody)
            // ws.cell(14 + index, 9).string(item.estado).style(styleBody)
            // if (item.estado === "ANULADO") {
            //     ws.cell(14 + index, 10).number(0).style(styleBodyFloat)
            //     ws.cell(14 + index, 11).number(parseFloat(formatMoney(item.total))).style(styleBodyFloat)
            // } else {
            //     ws.cell(14 + index, 10).number(parseFloat(formatMoney(item.total))).style(styleBodyFloat)
            //     ws.cell(14 + index, 11).number(0).style(styleBodyFloat)
            // }
            // });


            const data = await wb.writeToBuffer()

            res.end(data);
        } catch (error) {
            sendError(res, "Error al obtener el PDF")
        }
    }

    async reportePdfFinanciero(req, res) {
        try {
            const fechaInicio = req.params.fechaInicio;
            const fechaFinal = req.params.fechaFinal;
            const idSucursal = req.params.idSucursal === "-" ? "" : req.params.idSucursal;
            const idUsuario = req.params.idUsuario === "-" ? "" : req.params.idUsuario;

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

            const newEmpresa = {
                ...empresa[0],
                "logoEmpresa": `${process.env.APP_URL}/files/company/${empresa[0].rutaLogo}`,
                "logoDesarrollador": `${process.env.APP_URL}/files/to/logo.png`,
            }

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
                req.params.idSucursalGenerado
            ]);

            const conceptos = await conec.procedure(`CALL Obtener_Financiero_Reporte(?,?,?,?)`, [
                fechaInicio,
                fechaFinal,
                idSucursal,
                idUsuario
            ])

            const bancos = await conec.procedure(`CALL Obtener_Resumen_Banco(?,?,?,?)`, [
                fechaInicio,
                fechaFinal,
                idSucursal,
                idUsuario
            ]);

            let sucursalFiltro = null;

            if (idSucursal !== "") {
                sucursalFiltro = await conec.query(`
                SELECT 
                    nombre
                FROM 
                    sucursal
                WHERE
                    idSucursal = ?`, [
                    idSucursal
                ]);
            }

            let usuario = null;

            if (idUsuario !== "") {
                usuario = await conec.query(`
                SELECT 
                    p.descripcion AS rol,
                    u.apellidos,
                    u.nombres
                FROM 
                    usuario AS u
                INNER JOIN 
                    perfil AS p ON u.idPerfil = p.idPerfil
                WHERE 
                    u.idUsuario = ?`, [
                    idUsuario
                ]);
            }

            const cabecera = {
                "fechaInicio": fechaInicio,
                "fechaFinal": fechaFinal,
                "sucursal": idSucursal === "" ? "TODOS" : sucursalFiltro[0].nombre,
                "rol": idUsuario === "" ? "-" : usuario[0].rol,
                "usuario": idUsuario == "" ? "TODOS" : usuario[0].apellidos + ", " + usuario[0].nombres
            }

            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/api/v1/finanzas/a4`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    "cabecera": cabecera,
                    "empresa": newEmpresa,
                    "sucursal": sucursal[0],
                    "conceptos": conceptos,
                    "bancos": bancos
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            sendPdf(res, response.data);
        } catch (error) {
            sendError(res, "Error al obtener el PDF")
        }
    }

    async reporteExcelFinanciero(req, res) {
        try {
            console.log(req.params)

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

    async reporteExcelCEPSunat(req, res){
        try{

        }catch(error){
            
        }
    }

}

module.exports = Reporte;