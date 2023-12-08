const xl = require('excel4node');
const { formatMoney, dateFormat } = require('../tools/Tools');

async function generateProductoDeuda(req, empresaInfo, data) {
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

        ws.column(1).setWidth(10);
        ws.column(2).setWidth(20);
        ws.column(3).setWidth(25);
        ws.column(4).setWidth(25);
        ws.column(5).setWidth(25);
        ws.column(6).setWidth(20);
        ws.column(7).setWidth(20);
        ws.column(8).setWidth(20);
        ws.column(9).setWidth(20);
        ws.column(10).setWidth(20);
        ws.column(11).setWidth(15);
        ws.column(12).setWidth(15);
        ws.column(13).setWidth(18);

        ws.cell(1, 1, 1, 13, true).string(`${empresaInfo.nombreEmpresa}`).style(styleTitle);
        ws.cell(2, 1, 2, 13, true).string(`RUC: ${empresaInfo.ruc}`).style(styleTitle);
        ws.cell(3, 1, 3, 13, true).string(`${empresaInfo.direccion}`).style(styleTitle);
        ws.cell(4, 1, 4, 13, true).string(`Celular: ${empresaInfo.celular} / Telefono: ${empresaInfo.telefono}`).style(styleTitle);

        ws.cell(6, 1, 6, 13, true).string(`REPORTE GENERAL DE VENTAS`).style(styleTitle);
        ws.cell(7, 1, 7, 13, true).string(`${req.query.porSucursal == "0" ? "SUCURSAL: " + req.query.nombreSucursal : "TODOS LOS SUCURSALES"}`).style(styleTitle);

        const header = ["N°", "Cliente", "Propiedad", "Comprobante", "1° Pago", "Cta Mensual", "Cta Total", "Ctas Pagadas", "Ctas Pendiente", "Frecuencia", "Total", "Cobrado", "Por Cobrar"];

        header.map((item, index) => ws.cell(9, 1 + index).string(item).style(styleTableHeader));

        let rowY = 9;
        data.map((item, index) => {
            rowY = rowY + 1;
            const cuotaPagada = item.cuoTotal - item.numCuota;

            ws.cell(rowY, 1).number(1 + index).style(styleBodyInteger)
            ws.cell(rowY, 2).string(item.documento + "\n" + item.informacion).style(styleBody)
            ws.cell(rowY, 3).string(item.producto + "\n " + item.categoria).style(styleBody)
            ws.cell(rowY, 4).string(item.comprobante + "\n" + item.serie + "-" + item.numeracion).style(styleBody)
            ws.cell(rowY, 5).string(item.primerPago).style(styleBody)
            ws.cell(rowY, 6).number(parseFloat(formatMoney(item.cuotaMensual))).style(styleBodyFloat)
            ws.cell(rowY, 7).string(item.credito === 1 ? item.frecuencia : item.cuoTotal === 1 ? item.cuoTotal + " Cuota" : item.cuoTotal + " Cuotas").style(styleBody)
            ws.cell(rowY, 8).string(item.credito === 1 ? "-" : cuotaPagada === 1 ? cuotaPagada + " Cuota" : cuotaPagada + " Cuotas").style(styleBody)
            ws.cell(rowY, 9).string(item.credito === 1 ? item.frecuencia : item.numCuota === 1 ? item.numCuota + " Cuota" : item.numCuota + " Cuotas").style(styleBody)
            ws.cell(rowY, 10).string(item.frecuenciaName).style(styleBody)
            ws.cell(rowY, 11).number(parseFloat(formatMoney(item.total))).style(styleBodyFloat)
            ws.cell(rowY, 12).number(parseFloat(formatMoney(item.cobrado))).style(styleBodyFloat)
            ws.cell(rowY, 13).number(parseFloat(formatMoney(item.total - item.cobrado))).style(styleBodyFloat)
        });

        return wb.writeToBuffer();
    } catch (error) {
        return "Error en generar el excel.";
    }
}

module.exports = { generateProductoDeuda }