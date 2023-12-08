const path = require('path');
const PDFDocument = require("pdfkit-table");
const getStream = require('get-stream');
const { numberFormat, isFile } = require('../tools/Tools');

class RepCuota {

    async repDetalleCuota(req, empresaInfo, data) {
        const venta = data.venta;
        try {

            const doc = new PDFDocument({
                font: 'Helvetica',
                margins: {
                    top: 40,
                    bottom: 40,
                    left: 40,
                    right: 40
                }
            });

            doc.info["Title"] = "Cronograma de Pagos.pdf"

            let orgX = doc.x;
            let orgY = doc.y;
            let titleX = orgX + 150;
            let medioX = doc.page.width / 2;

            let h1 = 13;
            let h2 = 11;
            let h3 = 9;

            if (isFile(path.join(__dirname, "..", "path/company/" + empresaInfo.rutaLogo))) {
                doc.image(path.join(__dirname, "..", "path/company/" + empresaInfo.rutaLogo), orgX, orgY, { width: 75 });
            } else {
                doc.image(path.join(__dirname, "..", "path/to/noimage.jpg"), orgX, orgY, { width: 75 });
            }

            doc.fontSize(h1).text(
                `${empresaInfo.nombreEmpresa}`,
                titleX,
                orgY,
                {
                    width: 250,
                    align: "center"
                }
            );

            doc.fontSize(h3).text(
                `RUC: ${empresaInfo.ruc}`,
                titleX,
                doc.y,
                {
                    width: 250,
                    align: "center",
                }
            );

            doc.fontSize(h3).text(
                empresaInfo.direccion,
                titleX,
                doc.y,
                {
                    width: 250,
                    align: "center",
                }
            );

            doc.fontSize(h3).text(
                `Celular: ${empresaInfo.celular} / Telefono: ${empresaInfo.telefono}`,
                titleX,
                doc.y,
                {
                    width: 250,
                    align: "center",
                }
            );

            doc.fontSize(h2);

            const title = "CRONOGRAMA DE CUOTAS";
            let widthtext = Math.round(doc.widthOfString(title));

            doc.text(
                title,
                (doc.page.width - widthtext) / 2,
                doc.y,
                {
                    width: widthtext
                }
            );

            doc.opacity(0.7)
            doc.fontSize(h3).text(
                `${req.query.sucursal}`,
                orgX,
                doc.y + 10,
                {
                    width: 250,
                    align: "left",
                }
            );
            // reset 
            doc.fill('#000').stroke('#000');
            doc.lineGap(4);
            doc.opacity(1)

            const filtroY = doc.y;

            // ==============================================================================================
            doc.fontSize(h3).text(
                `Cliente: ${venta.informacion}`,
                orgX,
                filtroY + 10
            );

            doc.fontSize(h3).text(
                `Monto Total: ${numberFormat(venta.total)}`,
                orgX,
                doc.y
            );

            doc.fontSize(h3).text(
                `Monto Cobrado: ${numberFormat(venta.cobrado)}`,
                orgX,
                doc.y
            );

            doc.fontSize(h3).text(
                `Monto Restante: ${numberFormat(venta.total - venta.cobrado)}`,
                orgX,
                doc.y
            );

            // ==============================================================================================
            doc.fontSize(h3).text(
                `Dni/Ruc: ${venta.documento}`,
                medioX,
                filtroY + 10
            );

            doc.fontSize(h3).text(
                `Monto Inicial:  ${data.inicial.length === 0 ? "Sin Inicial" : numberFormat(data.inicial.reduce((previousValue, currentValue) => previousValue + currentValue.monto, 0))}`,
                medioX,
                doc.y
            );

            doc.fontSize(h3).text(
                `N° Cuotas: ${venta.credito === 1 ? "Variable" : venta.numCuota}`,
                medioX,
                doc.y
            );

            doc.fontSize(h3).text(
                `Comprobante: ${venta.nombre} ${venta.serie} - ${venta.numeracion}`,
                medioX,
                doc.y
            );


            // ==============================================================================================

            const productos = data.productos.map((item, index) => {
                return [++index, item.producto, numberFormat(item.precio), item.areProducto, item.categoria]
            })

            const productosTabla = {
                subtitle: `LISTA DE PRODUCTOS ASOCIADOS A LA VENTA`,
                headers: ["N°", "PRODUCTO", "PRECIO", "AREA m2", "CATEGORIA"],
                rows: productos
            };

            doc.table(productosTabla, {
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(h3),
                prepareRow: () => {
                    doc.font("Helvetica").fontSize(h3);
                },
                padding: 5,
                columnSpacing: 5,
                columnsSize: [60, 162, 110, 100, 100], //532
                width: (doc.page.width - doc.options.margins.left - doc.options.margins.right),
                x: orgX,
                y: doc.y + 15,
            });

            // ==============================================================================================
            const inicial = data.inicial.length === 0 ? [["", "SIN INICIAL", ""]] : data.inicial.map((item, index) => {
                return [++index, item.comprobante, numberFormat(item.monto)]
            });

            const inicialTabla = {
                subtitle: `INICIAL`,
                headers: ["N°", "CONCEPTO", "MONTO"],
                rows: inicial
            };

            doc.table(inicialTabla, {
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(h3),
                prepareRow: () => {
                    doc.font("Helvetica").fontSize(h3);
                },
                padding: 5,
                columnSpacing: 5,
                columnsSize: [60, 162 + 100 + 100, 110], //532
                width: (doc.page.width - doc.options.margins.left - doc.options.margins.right),
                x: orgX,
                y: doc.y + 15,

            });

            // ==============================================================================================

            const cobros = data.cobros.length == 0 ? [["", "NO HAY COBROS", ""]] : data.cobros.map((item, index) => {
                return [++index, item.concepto, numberFormat(item.monto)];
            });

            const cobrosTabla = {
                subtitle: `COBROS`,
                headers: ["N°", "CONCEPTO", "MONTO"],
                rows: cobros
            };

            doc.table(cobrosTabla, {
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(h3),
                prepareRow: () => {
                    doc.font("Helvetica").fontSize(h3);
                },
                padding: 5,
                columnSpacing: 5,
                columnsSize: [60, 162 + 100 + 100, 110], //532
                width: (doc.page.width - doc.options.margins.left - doc.options.margins.right),
                x: orgX,
                y: doc.y + 15,

            });

            // ==============================================================================================
            let credito = venta.total - data.inicial.reduce((previousValue, currentValue) => previousValue + currentValue.monto, 0)
            let arrayIni = [0, '', '', '', numberFormat(credito), ''];
            
            let content = data.plazos.map((item, index) => {
                credito = credito - item.monto;

                return [
                    ++index,
                    "CUOTA " + item.cuota,
                    item.fecha,
                    item.estado === 1 ? 'COBRADO' : item.vencido === 1 ? 'VENCIDO' : item.vencido === 2 ? 'POR VENCER' : 'POR COBRAR',
                    numberFormat(credito),
                    //                                       480    - 
                    item.estado === 1 ? 0 : numberFormat(item.monto - item.cobrado)]
            })

            content.unshift(arrayIni)

            const table1 = {
                subtitle: "CRONOGRAMA DE PAGOS MENSUALES - VENTA AL CRÉDITO",
                headers: ["#", "CUOTA", "FECHA DE PAGO", "ESTADO", "MONTO RESTANTE", "CUOTA RESTANTE"],
                rows: content
            };

            doc.table(table1, {
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(h3),
                prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
                    if (indexColumn === 3) {
                        if (row[3] === "COBRADO") {
                            doc.font("Helvetica").fontSize(h3).fillColor("green");
                        } else if (row[3] === "VENCIDO") {
                            doc.font("Helvetica").fontSize(h3).fillColor("red");
                        } else if (row[3] === "POR VENCER") {
                            doc.font("Helvetica").fontSize(h3).fillColor("orange");
                        }
                        else {
                            doc.font("Helvetica").fontSize(h3).fillColor("black");
                        }
                    } else {
                        doc.font("Helvetica").fontSize(h3).fillColor("black");
                    }
                },
                padding: 5,
                columnSpacing: 5,
                columnsSize: [60, 102, 100, 90, 90, 90], //532
                width: doc.page.width - doc.options.margins.left - doc.options.margins.right,
                x: orgX,
                y: doc.y + 10,
            });
            // ==============================================================================================

            doc.end();
            return getStream.buffer(doc);
        } catch (error) {
            console.log(error);
            return "Se genero un error al generar el reporte.";
        }
    }

}

module.exports = RepCuota;