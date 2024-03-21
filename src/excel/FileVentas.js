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
        ws.column(2).setWidth(15);
        ws.column(3).setWidth(15);
        ws.column(4).setWidth(20);
        ws.column(5).setWidth(20);
        ws.column(6).setWidth(18);
        ws.column(7).setWidth(20);
        ws.column(8).setWidth(15);
        ws.column(9).setWidth(18);
        ws.column(10).setWidth(18);
        ws.column(11).setWidth(18);

        // ws.cell(1, 1, 1, 11, true).string(`${empresaInfo.nombreEmpresa}`).style(styleTitle);
        // ws.cell(2, 1, 2, 11, true).string(`RUC: ${empresaInfo.ruc}`).style(styleTitle);
        // ws.cell(3, 1, 3, 11, true).string(`${empresaInfo.direccion}`).style(styleTitle);
        // ws.cell(4, 1, 4, 11, true).string(`Celular: ${empresaInfo.celular} / Telefono: ${empresaInfo.telefono}`).style(styleTitle);

        // ws.cell(6, 1, 6, 11, true).string(`REPORTE GENERAL DE VENTAS`).style(styleTitle);
        // ws.cell(7, 1, 7, 11, true).string(`PERIODO: ${dateFormat(req.query.fechaIni)} al ${dateFormat(req.query.fechaFin)}`).style(styleTitle);

        // ws.cell(9, 1).string(`Comprobante(s):`).style(styleHeader);
        // ws.cell(9, 2).string(`${req.query.idComprobante === '' ? "TODOS" : req.query.comprobante}`).style(styleHeader);

        // ws.cell(10, 1).string(`Cliente(s):`).style(styleHeader);
        // ws.cell(10, 2).string(`${req.query.idCliente === '' ? "TODOS" : req.query.cliente}`).style(styleHeader);

        // ws.cell(11, 1).string(`Vendedor(s):`).style(styleHeader);
        // ws.cell(11, 2).string(`${req.query.idUsuario === '' ? "TODOS" : req.query.usuario}`).style(styleHeader);

        // ws.cell(9, 5).string(`Tipo(s):`).style(styleHeader);
        // ws.cell(9, 6).string(`${req.query.tipoVenta === 0 ? "TODOS" : req.query.tipo}`).style(styleHeader);

        // const header = ["N°","Fecha", "N° Documento", "Información", "Comprobante", "Serie y Numeración", "Propiedad", "Tipo", "Estado", "Importe", "Anulado"];

        // header.map((item, index) => ws.cell(13, 1 + index).string(item).style(styleTableHeader));

        // data.map((item, index) => {

        //     ws.cell(14 + index, 1).number(parseInt(index+1)).style(styleBodyInteger)
        //     ws.cell(14 + index, 2).string(item.fecha).style(styleBody)
        //     ws.cell(14 + index, 3).number(parseInt(item.documento)).style(styleBodyInteger)
        //     ws.cell(14 + index, 4).string(item.informacion).style(styleBody)
        //     ws.cell(14 + index, 5).string(item.comprobante).style(styleBody)
        //     ws.cell(14 + index, 6).string(item.serie + "-" + item.numeracion).style(styleBody)
        //     ws.cell(14 + index, 7).string(item.producto + " - " + item.categoria).style(styleBody)
        //     ws.cell(14 + index, 8).string(item.tipo).style(styleBody)
        //     ws.cell(14 + index, 9).string(item.estado).style(styleBody)
        //     if (item.estado === "ANULADO") {
        //         ws.cell(14 + index, 10).number(0).style(styleBodyFloat)
        //         ws.cell(14 + index, 11).number(parseFloat(formatMoney(item.total))).style(styleBodyFloat)
        //     } else {
        //         ws.cell(14 + index, 10).number(parseFloat(formatMoney(item.total))).style(styleBodyFloat)
        //         ws.cell(14 + index, 11).number(0).style(styleBodyFloat)
        //     }
        // });

        return wb.writeToBuffer();
    } catch (error) {
        return "Error en generar el excel.";
    }
}

module.exports = { generateExcel }