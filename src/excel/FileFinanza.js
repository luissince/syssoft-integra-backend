const xl = require('excel4node');
const { formatMoney, dateFormat } = require('../tools/Tools');

async function generateExcel(req, empresaInfo, data) {
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

        if (req.query.isDetallado) {
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

            ws.cell(1, 1, 1, 11, true).string(`${empresaInfo.nombreEmpresa}`).style(styleTitle);
            ws.cell(2, 1, 2, 11, true).string(`RUC: ${empresaInfo.ruc}`).style(styleTitle);
            ws.cell(3, 1, 3, 11, true).string(`${empresaInfo.direccion}`).style(styleTitle);
            ws.cell(4, 1, 4, 11, true).string(`Celular: ${empresaInfo.celular} / Telefono: ${empresaInfo.telefono}`).style(styleTitle);

            ws.cell(6, 1, 6, 11, true).string(`REPORTE DE COBROS Y GASTOS`).style(styleTitle);
            if (empresaInfo.nombreSucursal) {
                ws.cell(7, 1, 7, 7, true).string(`SUCURSAL: ${empresaInfo.nombreSucursal}`).style(styleNameSucursal);
                ws.cell(7, 8, 7, 11, true).string(`PERIODO: ${dateFormat(req.query.fechaIni)} al ${dateFormat(req.query.fechaFin)}`).style(styleTitle);
            } else {
                ws.cell(7, 1, 7, 11, true).string(`PERIODO: ${dateFormat(req.query.fechaIni)} al ${dateFormat(req.query.fechaFin)}`).style(styleTitle);
            }

            const headerCon = ["#", "Comprobante", "Correlativo", "Documento", "Cliente", "Detalle", "Banco", "Fecha", "Usuario", "Monto", "Anulado"];
            headerCon.map((item, index) => ws.cell(9, 1 + index).string(item).style(styleTableHeader));

            let sumaMonto = 0;
            let rowY = 9;

            data.cobros.map((item, index) => {
                sumaMonto += item.estado == 1 && item.idNotaCredito == null ? item.monto : 0;
                rowY = rowY + 1;
                let correlativo = item.serie + "-" + item.numeracion
                let fechaHora = item.fecha + " " + item.hora

                styleBodyInteger.font.color = item.estado == 1 && item.idNotaCredito == null ? '#000000' : '#ff0000';
                styleBody.font.color = item.estado == 1 && item.idNotaCredito == null ? '#000000' : '#ff0000';
                styleBodyFloat.font.color = item.estado == 1 && item.idNotaCredito == null ? '#000000' : '#ff0000';

                ws.cell(rowY, 1).number(1 + index).style(styleBodyInteger)
                ws.cell(rowY, 2).string(item.comprobante).style(styleBody)
                ws.cell(rowY, 3).string(correlativo).style(styleBody)
                ws.cell(rowY, 4).string(item.documento).style(styleBody)
                ws.cell(rowY, 5).string(item.informacion).style(styleBody)
                ws.cell(rowY, 6).string(item.detalle).style(styleBody)
                ws.cell(rowY, 7).string(item.banco).style(styleBody)
                ws.cell(rowY, 8).string(fechaHora).style(styleBody)
                ws.cell(rowY, 9).string(item.nombres).style(styleBody)
                ws.cell(rowY, 10).number(parseFloat(formatMoney(item.estado == 1 && item.idNotaCredito == null ? item.monto : 0))).style(styleBodyFloat)
                ws.cell(rowY, 11).number(parseFloat(formatMoney(item.estado == 1 && item.idNotaCredito == null ? 0 : item.monto))).style(styleBodyFloat)
            });

            styleBody.font.color = '#000000';
            styleBodyFloat.font.color = '#000000';

            rowY = rowY + 1;

            ws.cell(rowY, 9).string("TOTAL:").style(styleBody)
            ws.cell(rowY, 10).number(parseFloat(formatMoney(sumaMonto))).style(styleBodyFloat)

        } else {
            ws.column(1).setWidth(10);
            ws.column(2).setWidth(20);
            ws.column(3).setWidth(15);
            ws.column(4).setWidth(15);
            ws.column(5).setWidth(15);
            ws.column(6).setWidth(15);

            ws.cell(1, 1, 1, 6, true).string(`${empresaInfo.nombreEmpresa}`).style(styleTitle);
            ws.cell(2, 1, 2, 6, true).string(`RUC: ${empresaInfo.ruc}`).style(styleTitle);
            ws.cell(3, 1, 3, 6, true).string(`${empresaInfo.direccion}`).style(styleTitle);
            ws.cell(4, 1, 4, 6, true).string(`Celular: ${empresaInfo.celular} / Telefono: ${empresaInfo.telefono}`).style(styleTitle);

            ws.cell(6, 1, 6, 6, true).string(`REPORTE DE COBROS Y GASTOS`).style(styleTitle);

            let rowY = 10;
            if (empresaInfo.nombreSucursal) {
                ws.cell(7, 1, 7, 6, true).string(`PERIODO: ${dateFormat(req.query.fechaIni)} al ${dateFormat(req.query.fechaFin)}`).style(styleTitle);
                ws.cell(9, 1, 9, 6, true).string(`SUCURSAL: ${empresaInfo.nombreSucursal}`).style(styleNameSucursal);


                ws.cell(11, 1, 11, 2, true).string(`RESUMEN DE CONCEPTOS`).style(styleHeader);

                rowY = 12;
            } else {
                ws.cell(7, 1, 7, 6, true).string(`PERIODO: ${dateFormat(req.query.fechaIni)} al ${dateFormat(req.query.fechaFin)}`).style(styleTitle);

                ws.cell(9, 1, 9, 2, true).string(`RESUMEN DE CONCEPTOS`).style(styleHeader);
            }

            const headerCon = ["#", "Concepto", "Cantidad", "Ingreso", "salida", "Total"];
            headerCon.map((item, index) => ws.cell(rowY, 1 + index).string(item).style(styleTableHeader));

            let sumaIngreso = 0;
            let sumaEgreso = 0;

            data.conceptos.map((item, index) => {
                rowY = rowY + 1;

                sumaIngreso += item.tipo === "INGRESO" ? item.monto : 0;
                sumaEgreso += item.tipo === "EGRESO" ? item.monto : 0;

                ws.cell(rowY, 1).number(1 + index).style(styleBodyInteger)
                ws.cell(rowY, 2).string(item.concepto).style(styleBody)
                ws.cell(rowY, 3).number(item.cantidad).style(styleBodyInteger)

                ws.cell(rowY, 4).number(parseFloat(item.tipo === "INGRESO" ? formatMoney(item.monto) : 0)).style(styleBodyFloat)
                ws.cell(rowY, 5).number(parseFloat(item.tipo === "EGRESO" ? formatMoney(item.monto) : 0)).style(styleBodyFloat)
            });

            rowY = rowY + 1;

            ws.cell(rowY, 3).string("TOTAL:").style(styleBody)
            ws.cell(rowY, 4).number(parseFloat(formatMoney(sumaIngreso))).style(styleBodyFloat)
            ws.cell(rowY, 5).number(parseFloat(formatMoney(sumaEgreso))).style(styleBodyFloat)
            ws.cell(rowY, 6).formula(`${'D' + rowY} + ${'E' + rowY}`).style(styleBodyFloat)

            rowY = rowY + 2;
            ws.cell(rowY, 1, rowY, 2, true).string(`RESUMEN BANCARIO`).style(styleHeader);

            rowY = rowY + 1;

            const headerBan = ["#", "Banco", "Tipo de Cuenta", "Monto"];
            headerBan.map((item, index) => ws.cell(rowY, 1 + index).string(item).style(styleTableHeader));

            let startPos = rowY + 1;
            let endPos = 0;
            data.bancos.map((item, index) => {
                rowY = rowY + 1;

                ws.cell(rowY, 1).number(1 + index).style(styleBodyInteger)
                ws.cell(rowY, 2).string(item.nombre).style(styleBody)
                ws.cell(rowY, 3).string(item.tipoCuenta).style(styleBody)
                ws.cell(rowY, 4).number(parseFloat(formatMoney(item.monto))).style(styleBodyFloat)
            });

            endPos = rowY;

            rowY = rowY + 1;

            ws.cell(rowY, 3).string("TOTAL:").style(styleBody)
            if (data.bancos.length > 0) ws.cell(rowY, 4).formula(`SUM(D${startPos}:D${endPos})`).style(styleBodyFloat)
        }
        return wb.writeToBuffer();
    } catch (error) {
        return "Error en generar el excel.";
    }
}

async function cpeSunat(req, empresaInfo, data) {
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

        ws.column(1).setWidth(5);//#
        ws.column(2).setWidth(20);//tipo documento
        ws.column(3).setWidth(15);//n° documento
        ws.column(4).setWidth(20);//cliente
        ws.column(5).setWidth(20);//tipo comprobante
        ws.column(6).setWidth(20);//comprobante
        ws.column(7).setWidth(15);//serie
        ws.column(8).setWidth(15);//numeracion
        ws.column(9).setWidth(15);//banco
        ws.column(10).setWidth(15);//metodo
        ws.column(11).setWidth(15);//fecha
        ws.column(12).setWidth(15);//monedda
        ws.column(13).setWidth(15);//base
        ws.column(14).setWidth(15);//igv
        ws.column(15).setWidth(15);//monto
        ws.column(16).setWidth(15);//anulado
        ws.column(17).setWidth(40);//sunat mensaje
        ws.column(18).setWidth(20);//refencia

        ws.cell(1, 1, 1, 18, true).string(`${empresaInfo.nombreEmpresa}`).style(styleTitle);
        ws.cell(2, 1, 2, 18, true).string(`RUC: ${empresaInfo.ruc}`).style(styleTitle);
        ws.cell(3, 1, 3, 18, true).string(`${empresaInfo.direccion}`).style(styleTitle);
        ws.cell(4, 1, 4, 18, true).string(`Celular: ${empresaInfo.celular} / Telefono: ${empresaInfo.telefono}`).style(styleTitle);

        ws.cell(6, 1, 6, 18, true).string(`REPORTE DE COMPROBANTES EMITIDOS A SUNAT`).style(styleTitle);
        ws.cell(7, 1, 7, 18, true).string(`PERIODO: ${dateFormat(req.query.fechaIni)} al ${dateFormat(req.query.fechaFin)}`).style(styleTitle);

        const headerCon = ["#", "Tipo de Documento", "N° de Documento", "Cliente", "Tipo Comprobante", "Comprobante", "Serie", "Numeración", "Banco", "Metodo", "Fecha", "Moneda", "Base", "Igv", "Monto", "Anulado", "Sunat Observación", "Referencia"];
        headerCon.map((item, index) => ws.cell(9, 1 + index).string(item).style(styleTableHeader));

        let rowY = 9;
        data.map((item, index) => {
            rowY = rowY + 1;

            styleBodyInteger.font.color = item.xmlSunat !== "1032" || item.xmlSunat == "" ? '#000000' : '#ff0000';
            styleBody.font.color = item.xmlSunat !== "1032" || item.xmlSunat == "" ? '#000000' : '#ff0000';
            styleBodyFloat.font.color = item.xmlSunat !== "1032" || item.xmlSunat == "" ? '#000000' : '#ff0000';

            let monto = item.xmlSunat !== "1032" || item.xmlSunat == "" ? (item.Base + item.Igv) : 0;
            let anulado = item.xmlSunat !== "1032" || item.xmlSunat == "" ? 0 : (item.Base + item.Igv);

            ws.cell(rowY, 1).number(1 + index).style(styleBodyInteger)
            ws.cell(rowY, 2).string(item.tipoDocumento).style(styleBody)
            ws.cell(rowY, 3).string(item.documento).style(styleBody)
            ws.cell(rowY, 4).string(item.informacion).style(styleBody)
            ws.cell(rowY, 5).string(item.codigoComprobante).style(styleBody)
            ws.cell(rowY, 6).string(item.comprobante).style(styleBody)
            ws.cell(rowY, 7).string(item.serie).style(styleBody)
            ws.cell(rowY, 8).number(item.numeracion).style(styleBodyInteger)

            ws.cell(rowY, 9).string(item.banco).style(styleBody)
            ws.cell(rowY, 10).string(item.metodoPago).style(styleBody)

            ws.cell(rowY, 11).string(item.fecha).style(styleBody)
            ws.cell(rowY, 12).string(item.codiso).style(styleBody)
            ws.cell(rowY, 13).number(parseFloat(formatMoney(item.Base))).style(styleBodyFloat)
            ws.cell(rowY, 14).number(parseFloat(formatMoney(item.Igv))).style(styleBodyFloat)
            ws.cell(rowY, 15).number(parseFloat(formatMoney(monto))).style(styleBodyFloat)
            ws.cell(rowY, 16).number(parseFloat(formatMoney(anulado))).style(styleBodyFloat)
            ws.cell(rowY, 17).string(item.xmlDescripcion).style(styleBody)
            ws.cell(rowY, 18).string(item.referencia).style(styleBody)
        });

        return wb.writeToBuffer();
    } catch (error) {
        return "Error en generar el excel.";
    }
}

module.exports = { generateExcel, cpeSunat }