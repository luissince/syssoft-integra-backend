const path = require('path');
const PDFDocument = require("pdfkit-table");
const getStream = require('get-stream');
const qr = require("qrcode");
const NumberLleters = require('../tools/NumberLleters');
const { formatMoney, numberFormat, calculateTaxBruto, calculateTax, dateFormat, zfill, isFile, categoriaProducto } = require('../tools/Tools');


const numberLleters = new NumberLleters();

class RepNotaCredito {

    async repComprobante(req, empresaInfo, data) {
        const cabecera = data.cabecera;
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

            doc.info["Title"] = `${cabecera.comprobante} ${cabecera.serie + "-" + cabecera.numeracion}`

            let orgX = doc.x;
            let orgY = doc.y;

            let medioX = doc.page.width / 2;

            let h1 = 13;
            let h2 = 11;
            let h3 = 9;

            if (isFile(path.join(__dirname, "..", "path/company/" + empresaInfo.rutaLogo))) {
                doc.image(path.join(__dirname, "..", "path/company/" + empresaInfo.rutaLogo), orgX, orgY, { width: 75 });
            } else {
                doc.image(path.join(__dirname, "..", "path/to/noimage.jpg"), orgX, orgY, { width: 75 });
            }

            let center = doc.page.width - doc.options.margins.left - doc.options.margins.right - 150 - 150;

            doc.fontSize(h1).text(
                `${empresaInfo.nombreEmpresa}`,
                doc.options.margins.left + 150,
                orgY + 10,
                {
                    width: center,
                    align: "center"
                }
            );

            doc.fontSize(h3).text(
                `${empresaInfo.direccion}\nCelular: ${empresaInfo.celular} / Telefono: ${empresaInfo.telefono}\n${empresaInfo.email}`,
                doc.options.margins.left + 150,
                doc.y,
                {
                    width: center,
                    align: "center",
                }
            );

            doc.fontSize(h2).text(
                `RUC: ${empresaInfo.ruc}\n${cabecera.comprobante}\n${cabecera.serie + "-" + cabecera.numeracion}`,
                doc.page.width - 150 - doc.options.margins.right,
                orgY + 20,
                {
                    width: 150,
                    align: "center",
                }
            );

            doc.rect(
                doc.page.width - 150 - doc.options.margins.right,
                orgY,
                150,
                70).stroke();

            doc.fontSize(h3).opacity(0.7).text(
                "INFORMACIÓN",
                doc.options.margins.top,
                doc.y + 30
            );

            doc.opacity(1).fill("#000000");

            let topCebecera = doc.y + 5;

            doc.lineGap(4);

            doc.fontSize(h3).text(
                `Tipo de documento: ${cabecera.tipoDoc} \nN° de documento: ${cabecera.documento} \nNombre/Razón Social: ${cabecera.informacion}\nDirección: ${cabecera.direccion}`,
                doc.options.margins.left,
                topCebecera
            );

            doc.fontSize(h3).text(
                `Fecha: ${cabecera.fecha} \nMoneda: ${cabecera.moneda + " - " + cabecera.codiso}\nMotivo Anulación: ${cabecera.motivo}\nCompr. Modificado: ${cabecera.serieModi+"-"+cabecera.numeracionModi}`,
                medioX,
                topCebecera
            );

            doc.lineGap(0);

            doc.x = doc.options.margins.left;

            let detalle = data.detalle.map((item, index) => {
                return [
                    ++index,
                    item.unidad,
                    item.cantidad,
                    item.concepto,
                    numberFormat(item.precio, cabecera.codiso),
                    numberFormat((item.precio * item.cantidad), cabecera.codiso)
                ];
            });

            const table = {
                subtitle: "DETALLE",
                headers: [
                    "Ítem",
                    "Medida",
                    "Cantidad",
                    "Descripción",
                    "Valor Unitario",
                    "Precio de Venta"
                ],
                rows: detalle,
            };

            doc.table(table, {
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(h3),
                prepareRow: () => {
                    doc.font("Helvetica").fontSize(h3);
                },
                padding: 5,
                columnSpacing: 5,
                columnsSize: [30, 80, 90, 152, 90, 90],
                x: doc.x,
                y: doc.y + 20,
                width: doc.page.width - doc.options.margins.left - doc.options.margins.right
            });

            doc.x = 0;

            let subTotal = 0;
            let impuestoTotal = 0;
            let total = 0;
            let impuestos = [];

            for (let item of data.detalle) {
                let cantidad = item.cantidad;
                let valor = item.precio;

                let impuesto = item.porcentaje;

                let valorActual = cantidad * valor;
                let valorSubNeto = calculateTaxBruto(impuesto, valorActual);
                let valorImpuesto = calculateTax(impuesto, valorSubNeto);
                let valorNeto = valorSubNeto + valorImpuesto;

                impuestos.push({ "idImpuesto": item.idImpuesto, "nombre": item.impuesto, "valor": valorImpuesto });

                subTotal += valorSubNeto;
                impuestoTotal += valorImpuesto;
                total += valorNeto;
            }

            let arrayImpuestos = [];
            for (let item of impuestos) {
                if (!this.duplicateImpuestos(arrayImpuestos, item)) {
                    arrayImpuestos.push(item)
                } else {
                    for (let newItem of arrayImpuestos) {
                        if (newItem.idImpuesto === item.idImpuesto) {
                            let currenteObject = newItem;
                            currenteObject.valor += parseFloat(item.valor);
                            break;
                        }
                    }
                }
            }

            let ypost = doc.y + 5;
            doc.fontSize(h3);

            let text = "IMPORTE BRUTO:";
            let widthtext = doc.widthOfString(text);

            let subtext = numberFormat(subTotal, cabecera.codiso);
            let widthsubtext = doc.widthOfString(subtext);

            doc.font('Helvetica').text(text,
                doc.page.width - doc.options.margins.right - widthtext - widthsubtext - 20,
                ypost, {
                width: widthtext + 10,
                align: "right",
            });

            doc.font('Helvetica-Bold').text(subtext,
                doc.page.width - doc.options.margins.right - widthsubtext,
                ypost, {
                width: widthsubtext,
                align: "right",
            });

            // 
            ypost = doc.y + 5;

            text = "DESCUENTO:";
            widthtext = doc.widthOfString(text);

            subtext = numberFormat(0, cabecera.codiso);
            widthsubtext = doc.widthOfString(subtext);

            doc.font('Helvetica').text(text,
                doc.page.width - doc.options.margins.right - widthtext - widthsubtext - 20,
                ypost, {
                width: widthtext + 10,
                align: "right",
            });

            doc.font('Helvetica-Bold').text(subtext,
                doc.page.width - doc.options.margins.right - widthsubtext,
                ypost, {
                width: widthsubtext,
                align: "right",
            });

            // 
            ypost = doc.y + 5;

            text = "SUB IMPORTE:";
            widthtext = doc.widthOfString(text);

            subtext = numberFormat(subTotal, cabecera.codiso);
            widthsubtext = doc.widthOfString(subtext);

            doc.font('Helvetica').text(text,
                doc.page.width - doc.options.margins.right - widthtext - widthsubtext - 20,
                ypost, {
                width: widthtext + 10,
                align: "right",
            });

            doc.font('Helvetica-Bold').text(subtext,
                doc.page.width - doc.options.margins.right - widthsubtext,
                ypost, {
                width: widthsubtext,
                align: "right",
            });

            

            for (let item of arrayImpuestos) {
                ypost = doc.y + 5;

                text = item.nombre + ":";
                widthtext = doc.widthOfString(text);

                subtext = numberFormat(item.valor, cabecera.codiso);
                widthsubtext = doc.widthOfString(subtext);

                doc.font('Helvetica').text(text,
                    doc.page.width - doc.options.margins.right - widthtext - widthsubtext - 20,
                    ypost, {
                    width: widthtext + 10,
                    align: "right",
                });

                doc.font('Helvetica-Bold').text(subtext,
                    doc.page.width - doc.options.margins.right - widthsubtext,
                    ypost, {
                    width: widthsubtext,
                    align: "right",
                });
            }

            // 
            ypost = doc.y + 5;

            text = "IMPORTE NETO:";
            widthtext = doc.widthOfString(text);

            subtext = numberFormat(total, cabecera.codiso);
            widthsubtext = doc.widthOfString(subtext);

            doc.font('Helvetica').text(text,
                doc.page.width - doc.options.margins.right - widthtext - widthsubtext - 20,
                ypost, {
                width: widthtext + 10,
                align: "right",
            });

            doc.font('Helvetica-Bold').text(subtext,
                doc.page.width - doc.options.margins.right - widthsubtext,
                ypost, {
                width: widthsubtext,
                align: "right",
            });

            doc.font('Helvetica').fontSize(h3).text(`SON: ${numberLleters.getResult(formatMoney(total), cabecera.moneda)}`,
                doc.options.margins.left,
                doc.y + 5);

            let qrResult = await this.qrGenerate(`|
            ${empresaInfo.ruc}|
            ${cabecera.codigoVenta}|
            ${cabecera.serie}|
            ${cabecera.numeracion}|
            ${impuestoTotal}|
            ${total}|
            ${cabecera.fecha}|
            ${cabecera.codigoCliente}|
            ${cabecera.documento}|`);

            doc.image(qrResult, doc.options.margins.left, doc.y, { width: 100, });

            // if (cabecera.estado === 3) {
            //     doc.save();
            //     doc.rotate(-45, { origin: [200, 450] });
            //     doc.fontSize(100).fillColor("#cccccc").opacity(0.5).text('ANULADO', (doc.page.width - 500) / 2, 450, {
            //         textAlign: 'center',
            //     });
            //     doc.rotate(-45 * (-1), { origin: [200, 450] });
            //     doc.restore();
            // }

            doc.end();
            return getStream.buffer(doc);

        } catch (error) {
            return "Se genero un error al generar el reporte.";
        }
    }


    duplicateImpuestos(array, impuesto) {
        let value = false
        for (let item of array) {
            if (item.idImpuesto === impuesto.idImpuesto) {
                value = true
                break;
            }
        }
        return value
    }

    qrGenerate(data) {
        return new Promise((resolve, reject) => {
            qr.toDataURL(data, (err, src) => {
                if (err) reject("Error occured");

                resolve(src);
            });
        })
    }
}

module.exports = RepNotaCredito;