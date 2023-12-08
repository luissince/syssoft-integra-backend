const xl = require('excel4node');
const { formatMoney, dateFormat, numberFormat } = require('../tools/Tools');

async function generateExcelCliente(req, empresaInfo, data, condicion) {
    try {
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

        if (condicion == 0) {

            ws.column(1).setWidth(10);
            ws.column(2).setWidth(20);
            ws.column(3).setWidth(30);
            ws.column(4).setWidth(20);

            ws.cell(1, 1, 1, 4, true).string(`${empresaInfo.nombreEmpresa}`).style(styleTitle);
            ws.cell(2, 1, 2, 4, true).string(`RUC: ${empresaInfo.ruc}`).style(styleTitle);
            ws.cell(3, 1, 3, 4, true).string(`${empresaInfo.direccion}`).style(styleTitle);
            ws.cell(4, 1, 4, 4, true).string(`Celular: ${empresaInfo.celular} / Telefono: ${empresaInfo.telefono}`).style(styleTitle);

            ws.cell(6, 1, 6, 4, true).string(`REPORTE DE CLIENTES`).style(styleTitle);
            ws.cell(7, 1, 7, 4, true).string(`PERIODO: ${dateFormat(req.query.fechaIni)} al ${dateFormat(req.query.fechaFin)}`).style(styleTitle);

            ws.cell(9, 1).string(`CLIENTE:`).style(styleHeader);
            ws.cell(9, 2).string(`${req.query.idCliente === "" ? "TODOS" : req.query.cliente}`).style(styleHeader);

            const header = ["N°", "N° de Documento", "Información", "Monto"];
            header.map((item, index) => ws.cell(11, 1 + index).string(item).style(styleTableHeader));

            let array = [];
            for (let item of data) {

                if (array.filter(f => f.idCliente === item.idCliente).length === 0) {
                    array.push({
                        "idCliente": item.idCliente,
                        "documento": item.documento,
                        "informacion": item.informacion,
                        "ingresos": item.ingresos,
                        "ventas": item.ventas,
                    });
                } else {
                    for (let newItem of array) {
                        if (newItem.idCliente === item.idCliente) {
                            let currenteObject = newItem;
                            currenteObject.ingresos += parseFloat(item.ingresos);
                            currenteObject.ventas += parseFloat(item.ventas);
                            break;
                        }
                    }
                }
            }

            let rowY = 11;
            let startPos = rowY + 1;
            let endPos = 0;
            array.map((item, index) => {
                rowY = rowY + 1;

                ws.cell(rowY, 1).number(1 + index).style(styleBodyInteger)
                ws.cell(rowY, 2).number(parseInt(item.documento)).style(styleBody)
                ws.cell(rowY, 3).string(item.informacion).style(styleBody)
                ws.cell(rowY, 4).number(parseFloat(formatMoney(item.ingresos + item.ventas))).style(styleBodyFloat)
            });

            endPos = rowY;

            rowY = rowY + 1;
            ws.cell(rowY, 3).string("TOTAL:").style(styleBody)
            if (array.length > 0) ws.cell(rowY, 4).formula(`SUM(D${startPos}:D${endPos})`).style(styleBodyFloat)

            return wb.writeToBuffer();

        } else {

            ws.column(1).setWidth(10);
            ws.column(2).setWidth(20);
            ws.column(3).setWidth(30);
            ws.column(4).setWidth(20);
            ws.column(5).setWidth(30);
            ws.column(6).setWidth(20);

            ws.cell(1, 1, 1, 6, true).string(`${empresaInfo.nombreEmpresa}`).style(styleTitle);
            ws.cell(2, 1, 2, 6, true).string(`RUC: ${empresaInfo.ruc}`).style(styleTitle);
            ws.cell(3, 1, 3, 6, true).string(`${empresaInfo.direccion}`).style(styleTitle);
            ws.cell(4, 1, 4, 6, true).string(`Celular: ${empresaInfo.celular} / Telefono: ${empresaInfo.telefono}`).style(styleTitle);

            ws.cell(6, 1, 6, 6, true).string(`LISTA DE APORTACIONES`).style(styleTitle);
            ws.cell(7, 1, 7, 6, true).string(`PERIODO: ${dateFormat(req.query.fechaIni)} al ${dateFormat(req.query.fechaFin)}`).style(styleTitle);

            ws.cell(9, 1).string(`CLIENTE:`).style(styleHeader);
            ws.cell(9, 2).string(`${req.query.idCliente === "" ? "TODOS" : req.query.cliente}`).style(styleHeader);

            const header = ["N°", "Fecha", "Comprobante", "Serie y Num", "Detalle", "Monto"];
            header.map((item, index) => ws.cell(11, 1 + index).string(item).style(styleTableHeader));

            let array = [];

            for (let item of data) {
                array.push({
                    "idCobro": item.idCobro,
                    "comprobante": item.comprobante,
                    "serie": item.serie,
                    "numeracion": item.numeracion,
                    "detalle": item.detalle,
                    "simbolo": item.simbolo,
                    "banco": item.banco,
                    "observacion": item.observacion,
                    "fecha": item.fecha,
                    "hora": item.hora,
                    "monto": item.monto
                });
            }

            let rowY = 11;

            array.map((item, index) => {
                rowY = rowY + 1;

                ws.cell(rowY, 1).number(1 + index).style(styleBodyInteger)
                ws.cell(rowY, 2).string(`${item.fecha} ${item.hora}`).style(styleBody)
                ws.cell(rowY, 3).string(item.comprobante).style(styleBody)
                ws.cell(rowY, 4).string(`${item.serie}-${item.numeracion}`).style(styleBody)
                ws.cell(rowY, 5).string(item.detalle).style(styleBody)
                ws.cell(rowY, 6).number(parseFloat(formatMoney(item.monto))).style(styleBodyFloat)
            });

            return wb.writeToBuffer();

        }

    } catch (error) {
        return "Error en generar el excel.";
    }
}

async function generateExcelDeudas(req, empresaInfo, data) {
    try {

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
        ws.column(3).setWidth(25);
        ws.column(4).setWidth(20);
        ws.column(5).setWidth(20);
        ws.column(6).setWidth(20);
        ws.column(7).setWidth(20);
        ws.column(8).setWidth(20);
        ws.column(9).setWidth(20);

        ws.cell(1, 1, 1, 9, true).string(`${empresaInfo.nombreEmpresa}`).style(styleTitle);
        ws.cell(2, 1, 2, 9, true).string(`RUC: ${empresaInfo.ruc}`).style(styleTitle);
        ws.cell(3, 1, 3, 9, true).string(`${empresaInfo.direccion}`).style(styleTitle);
        ws.cell(4, 1, 4, 9, true).string(`Celular: ${empresaInfo.celular} / Telefono: ${empresaInfo.telefono}`).style(styleTitle);

        ws.cell(6, 1, 6, 9, true).string(`LISTA DE DEUDAS POR CLIENTE`).style(styleTitle);

        const header = ["N°", "Cliente", "Propiedad", "Comprobante", "Cuotas Pendientes", "Sig. Pago", "Total", "Cobrado", "Por Cobrar"];
        header.map((item, index) => ws.cell(8, 1 + index).string(item).style(styleTableHeader));

        let rowY = 8;

        data.map((item, index) => {
            rowY = rowY + 1;

            ws.cell(rowY, 1).number(1 + index).style(styleBodyInteger)
            ws.cell(rowY, 2).string(item.documento + "\n" + item.informacion).style(styleBody)
            ws.cell(rowY, 3).string(item.producto).style(styleBody)
            ws.cell(rowY, 4).string(item.nombre + "\n" + item.serie + "-" + item.numeracion).style(styleBody)
            ws.cell(rowY, 5).string(item.numCuota == 1 ? item.numCuota + " COUTA" : item.numCuota + " COUTAS").style(styleBody)
            ws.cell(rowY, 6).string(dateFormat(item.fechaPago)).style(styleBody)

            ws.cell(rowY, 7).number(parseFloat(formatMoney(item.total))).style(styleBodyFloat)
            ws.cell(rowY, 8).number(parseFloat(formatMoney(item.cobrado))).style(styleBodyFloat)
            ws.cell(rowY, 9).number(parseFloat(formatMoney(item.total - item.cobrado))).style(styleBodyFloat)
        });
        rowY = rowY + 1;

        return wb.writeToBuffer();
    } catch (error) {
        return "Error en generar el excel.";
    }
}

async function generarSociosPorFecha(req, empresaInfo, data) {
    try {
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

        const styleSubTitle = wb.createStyle({
            alignment: {
                horizontal: 'left'
            },
            font: {
                color: '#000000',
                size: 10,
            },
        });

        const styleTableHeader = wb.createStyle({
            alignment: {
                horizontal: 'left'
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

        const fillSocio = {
            fill: {
                type: 'pattern',
                patternType: 'solid',
                fgColor: '#c7c7ff',
            }
        }

        const fillVenta = {
            font: {
                bold: true,
            },
            fill: {
                type: 'pattern',
                patternType: 'solid',
                fgColor: '#e6e6e6',
            }
        }

        const textSize = {
            font: {
                size: 10
            },
        }

        ws.column(1).setWidth(20);
        ws.column(2).setWidth(20);
        ws.column(3).setWidth(30);
        ws.column(4).setWidth(40);
        ws.column(5).setWidth(20);

        ws.cell(1, 1, 1, 5, true).string(`${empresaInfo.nombreEmpresa}`).style(styleTitle);
        ws.cell(2, 1, 2, 5, true).string(`RUC: ${empresaInfo.ruc}`).style(styleTitle);
        ws.cell(3, 1, 3, 5, true).string(`${empresaInfo.direccion}`).style(styleTitle);
        ws.cell(4, 1, 4, 5, true).string(`Celular: ${empresaInfo.celular} / Telefono: ${empresaInfo.telefono}`).style(styleTitle);

        ws.cell(6, 1, 6, 5, true).string(`LISTA DE SOCIOS AGREGADOS POR FECHA`).style(styleTitle);
        ws.cell(7, 1, 7, 5, true).string(req.query.porSucursal == "1" ? "TODOS LOS SUCURSALES" : `SUCURSAL: ${req.query.nombreSucursal}`).style(styleTitle);

        const header = ["N°", "Documento", "Socio", "Celular", "Teléfono"];
        header.map((item, index) => ws.cell(9, 1 + index).string(item).style(styleTableHeader).style(fillVenta));

        let rowY = 9;
        data.map((item, index) => {
            rowY = rowY + 1;

            ws.cell(rowY, 1).number(1 + index).style(styleBodyInteger).style(fillSocio);
            ws.cell(rowY, 2).string(item.documento).style(styleBody).style(fillSocio);
            ws.cell(rowY, 3).string(item.informacion).style(styleBody).style(fillSocio);
            ws.cell(rowY, 4).string(item.celular).style(styleBody).style(fillSocio);
            ws.cell(rowY, 5).string(item.telefono).style(styleBody).style(fillSocio);

            rowY = rowY + 1;
            ws.cell(rowY, 1).string("COMPROBANTE").style(styleSubTitle).style(fillVenta);
            ws.cell(rowY, 2).string("FECHA").style(styleSubTitle).style(fillVenta);
            ws.cell(rowY, 3).string("PRODUCTO").style(styleSubTitle).style(fillVenta);
            ws.cell(rowY, 4).string("FRECUENCIA").style(styleSubTitle).style(fillVenta);
            ws.cell(rowY, 5).string("MONTO TOTAL").style(styleSubTitle).style(fillVenta);

            for (const venta of item.detalle) {
                rowY = rowY + 1;
                ws.cell(rowY, 1).string(venta.serie + "-" + venta.numeracion).style(styleBody).style(textSize);
                ws.cell(rowY, 2).string(venta.fecha).style(styleBody).style(textSize);
                ws.cell(rowY, 3).string(venta.producto + " - " + venta.categoria).style(styleBody).style(textSize);
                ws.cell(rowY, 4).string(venta.frecuencia).style(styleBody).style(textSize);
                ws.cell(rowY, 5).number(parseFloat(formatMoney(venta.monto))).style(styleBodyFloat).style(textSize)
            }
        });
        rowY = rowY + 1;

        return wb.writeToBuffer();
    } catch (error) {
        console.log(error);
        return "Error en generar el excel.";
    }
}


module.exports = { generateExcelCliente, generateExcelDeudas, generarSociosPorFecha }