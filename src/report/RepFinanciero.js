const path = require('path');
const PDFDocument = require("pdfkit-table");
const getStream = require('get-stream');
const { dateFormat, numberFormat, currentDate, isFile } = require('../tools/Tools');

class RepFinanciero {

    async repFiltroCobros(req, empresaInfo, data) {
        try {
            const doc = new PDFDocument({
                margins: {
                    top: 40,
                    bottom: 40,
                    left: 40,
                    right: 40
                }
            });

            doc.info["Title"] = `REPORTE DE COBROS Y GASTOS DEL ${req.query.fechaIni} AL ${req.query.fechaFin}`

            let orgX = doc.x;
            let orgY = doc.y;
            let cabeceraY = orgY + 70;
            let titleX = orgX + 150;
            let widthContent = doc.page.width - doc.options.margins.left - doc.options.margins.right;

            let h1 = 13;
            let h2 = 11;
            let h3 = 9;

            if (isFile(path.join(__dirname, "..", "path/company/" + empresaInfo.rutaLogo))) {
                doc.image(path.join(__dirname, "..", "path/company/" + empresaInfo.rutaLogo), doc.x, doc.y, { width: 75 });
            } else {
                doc.image(path.join(__dirname, "..", "path/to/noimage.jpg"), doc.x, doc.y, { width: 75 });
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
                `RUC: ${empresaInfo.ruc}\n${empresaInfo.direccion}\nCelular: ${empresaInfo.celular} / Telefono: ${empresaInfo.telefono}`,
                titleX,
                orgY + 17,
                {
                    width: 250,
                    align: "center",
                }
            );

            doc.fontSize(h2).text(
                "REPORTE DE COBROS Y GASTOS",
                doc.options.margins.left,
                cabeceraY,
                {
                    width: widthContent,
                    align: "center",
                }
            );

            if (empresaInfo.nombreSucursal) {
                doc.fontSize(h3).text(
                    `SUCURSAL: ${empresaInfo.nombreSucursal}`,
                    orgX,
                    cabeceraY + 25,
                    {
                        width: 300,
                        align: "left",
                    }
                );

                doc.fontSize(h3).text(
                    `PERIODO: ${dateFormat(req.query.fechaIni)} al ${dateFormat(req.query.fechaFin)}`,
                    orgX + 200,
                    cabeceraY + 25,
                    {
                        width: 300,
                        align: "right",
                    }
                );
            } else {
                doc.fontSize(h3).text(
                    `PERIODO: ${dateFormat(req.query.fechaIni)} al ${dateFormat(req.query.fechaFin)}`,
                    orgX,
                    cabeceraY + 25,
                    {
                        width: 300,
                        align: "left",
                    }
                );
            }

            let sumaIngreso = 0;
            let sumaEgreso = 0;

            let conceptos = data.conceptos.map((item, index) => {
                sumaIngreso += item.tipo === "INGRESO" ? item.monto : 0;
                sumaEgreso += item.tipo === "EGRESO" ? item.monto : 0;
                return [
                    ++index,
                    item.concepto,
                    item.cantidad,
                    item.tipo === "INGRESO" ? numberFormat(item.monto) : "",
                    item.tipo === "EGRESO" ? numberFormat(item.monto) : "",
                ];
            });

            conceptos.push(["", "", "TOTAL:", numberFormat(sumaIngreso), numberFormat(sumaEgreso), numberFormat(sumaIngreso - sumaEgreso)]);

            //Tabla
            const tableConcepto = {
                subtitle: "RESUMEN DE CONCEPTOS",
                headers: ["#", "Concepto", "Cantidad", "Ingreso", "salida", "Total"],
                rows: conceptos
            };


            doc.table(tableConcepto, {
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(h3),
                prepareRow: () => {
                    doc.font("Helvetica").fontSize(h3);
                },
                padding: 5,
                columnSpacing: 5,
                columnsSize: [40, 132, 90, 90, 90, 90],
                x: orgX,
                y: doc.y + 20,
                width: doc.page.width - doc.options.margins.left - doc.options.margins.right
            });

            // 

            let sumaBanco = 0;

            let bancos = data.bancos.map((item, index) => {
                sumaBanco += item.monto;
                return [
                    ++index,
                    item.nombre,
                    item.tipoCuenta,
                    numberFormat(item.monto),
                ];
            });

            bancos.push(["", "", "TOTAL:", numberFormat(sumaBanco)]);

            //Tabla
            const table = {
                subtitle: "RESUMEN BANCARIO",
                headers: ["#", "Banco", "Tipo de Cuenta", "Monto"],
                rows: bancos
            };

            doc.table(table, {
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(h3),
                prepareRow: () => {
                    doc.font("Helvetica").fontSize(h3);
                },
                padding: 5,
                columnSpacing: 5,
                columnsSize: [40, 132, 90, 90],
                x: orgX,
                y: doc.y + 10,
                width: doc.page.width - doc.options.margins.left - doc.options.margins.right
            });

            // let ypost = doc.y + 5;
            // doc.fontSize(h3);

            // let nameContado = "TOTAL DE INGRESOS:";
            // let widthNameContado = doc.widthOfString(nameContado);

            // let totalContado = numberFormat(total);

            // let widthTotalContado = doc.widthOfString(totalContado);

            // doc.text(nameContado,
            //     doc.page.width - doc.options.margins.right - widthNameContado - widthTotalContado - 20,
            //     ypost, {
            //     width: widthNameContado + 10,
            //     align: "right",
            // });

            // doc.text(totalContado,
            //     doc.page.width - doc.options.margins.right - widthTotalContado,
            //     ypost, {
            //     width: widthTotalContado,
            //     stroke: "black",
            //     align: "right",
            // });

            doc.end();

            return getStream.buffer(doc);

        } catch (error) {
            return "Se genero un error al generar el reporte.";
        }
    }

    async repFiltroCobrosDetallados(req, empresaInfo, data) {
        try {
            const doc = new PDFDocument({
                margins: {
                    top: 40,
                    bottom: 40,
                    left: 40,
                    right: 40
                }
            });
            doc.info["Title"] = `REPORTE DE COBROS Y GASTOS DEL ${req.query.fechaIni} AL ${req.query.fechaFin}`

            let orgX = doc.x;
            let orgY = doc.y;
            let cabeceraY = orgY + 70;
            let titleX = orgX + 150;
            let widthContent = doc.page.width - doc.options.margins.left - doc.options.margins.right;

            let h1 = 13;
            let h2 = 11;
            let h3 = 9;
            let h4 = 8;

            if (isFile(path.join(__dirname, "..", "path/company/" + empresaInfo.rutaLogo))) {
                doc.image(path.join(__dirname, "..", "path/company/" + empresaInfo.rutaLogo), doc.x, doc.y, { width: 75 });
            } else {
                doc.image(path.join(__dirname, "..", "path/to/noimage.jpg"), doc.x, doc.y, { width: 75 });
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
                `RUC: ${empresaInfo.ruc}\n${empresaInfo.direccion}\nCelular: ${empresaInfo.celular} / Telefono: ${empresaInfo.telefono}`,
                titleX,
                orgY + 17,
                {
                    width: 250,
                    align: "center",
                }
            );

            doc.fontSize(h2).text(
                "REPORTE DE COBROS Y GASTOS",
                doc.options.margins.left,
                cabeceraY,
                {
                    width: widthContent,
                    align: "center",
                }
            );

            if (empresaInfo.nombreSucursal) {
                doc.fontSize(h3).text(
                    `SUCURSAL: ${empresaInfo.nombreSucursal}`,
                    orgX,
                    cabeceraY + 25,
                    {
                        width: 300,
                        align: "left",
                    }
                );

                doc.fontSize(h3).text(
                    `PERIODO: ${dateFormat(req.query.fechaIni)} al ${dateFormat(req.query.fechaFin)}`,
                    orgX + 200,
                    cabeceraY + 25,
                    {
                        width: 300,
                        align: "right",
                    }
                );
            } else {
                doc.fontSize(h3).text(
                    `PERIODO: ${dateFormat(req.query.fechaIni)} al ${dateFormat(req.query.fechaFin)}`,
                    orgX,
                    cabeceraY + 25,
                    {
                        width: 300,
                        align: "left",
                    }
                );
            }

            let sumaMontoCobros = 0;
            let cobros = data.cobros.map((item, index) => {
                sumaMontoCobros += item.estado == 1 && item.idNotaCredito == null ? item.monto : 0;
                return [
                    ++index,
                    item.comprobante + "\n" + item.serie + "-" + item.numeracion,
                    item.documento + "\n" + item.informacion,
                    item.detalle,
                    item.banco,
                    item.fecha + "\n" + item.hora,
                    item.nombres,
                    item.estado == 1 && item.idNotaCredito == null ? numberFormat(item.monto) : 0,
                    item.estado == 1 && item.idNotaCredito == null ? 0 : numberFormat(item.monto)
                ]
            });

            cobros.push(["", "", "", "", "", "", "TOTAL:", numberFormat(sumaMontoCobros), ""]);

            //Tabla
            const tableCobros = {
                subtitle: "RESUMEN DE COBROS",
                headers: ["#", "Correlativo", "Cliente", "Detalle", "Banco", "Fecha", "Usuario", "Monto", "Anulado"],
                rows: cobros
            };

            doc.table(tableCobros, {
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(h3),
                prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
                    if (indexColumn === 7) {
                        if (row[7] == "0") {
                            doc.font("Helvetica").fontSize(h4).fillColor("red");
                        }
                    } else {
                        doc.font("Helvetica").fontSize(h4).fillColor("black");
                    }
                },
                padding: 5,
                columnSpacing: 5,
                columnsSize: [22, 60, 80, 60, 60, 60, 70, 60, 60], //532
                x: orgX,
                y: doc.y + 20,
                width: doc.page.width - doc.options.margins.left - doc.options.margins.right
            });

            let sumaMontoGastos = 0;
            let gastos = data.gastos.map((item, index) => {
                sumaMontoGastos += item.monto;
                return [
                    ++index,
                    item.comprobante + "\n" + item.serie + "-" + item.numeracion,
                    item.documento + "\n" + item.informacion,
                    item.detalle,
                    item.banco,
                    item.fecha + "\n" + item.hora,
                    item.nombres,
                    numberFormat(item.monto)
                ]
            });

            gastos.push(["", "", "", "", "", "", "TOTAL:", numberFormat(sumaMontoGastos)]);

            //Tabla
            const tableGastos = {
                subtitle: "RESUMEN DE GASTOS",
                headers: ["#", "Correlativo", "Cliente", "Detalle", "Banco", "Fecha", "Usuario", "Monto"],
                rows: gastos
            };

            doc.table(tableGastos, {
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(h3),
                prepareRow: () => {
                    doc.font("Helvetica").fontSize(h3);
                },
                padding: 5,
                columnSpacing: 5,
                columnsSize: [22, 80, 100, 80, 60, 60, 70, 60], //532
                x: orgX,
                y: doc.y + 10,
                width: doc.page.width - doc.options.margins.left - doc.options.margins.right
            });

            doc.end();

            return getStream.buffer(doc);

        } catch (error) {
            return "Se genero un error al generar el reporte.";
        }
    }

    async repDetalleBanco(empresaInfo, data) {

        try {
            const cabecera = data.cabecera;
            
            const doc = new PDFDocument({
                margins: {
                    top: 40,
                    bottom: 40,
                    left: 40,
                    right: 40
                }
            });

            doc.info["Title"] = `REPORTE DE CAJA BANCO AL ${currentDate()}`

            let orgX = doc.x;
            let orgY = doc.y;
            let cabeceraY = orgY + 70;
            let titleX = orgX + 150;
            let medioX = (doc.page.width - doc.options.margins.left - doc.options.margins.right) / 2;

            let h1 = 13;
            let h2 = 11;
            let h3 = 9;

            if (isFile(path.join(__dirname, "..", "path/company/" + empresaInfo.rutaLogo))) {
                doc.image(path.join(__dirname, "..", "path/company/" + empresaInfo.rutaLogo), doc.x, doc.y, { width: 75 });
            } else {
                doc.image(path.join(__dirname, "..", "path/to/noimage.jpg"), doc.x, doc.y, { width: 75 });
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
                `RUC: ${empresaInfo.ruc}\n${empresaInfo.direccion}\nCelular: ${empresaInfo.celular} / Telefono: ${empresaInfo.telefono}`,
                titleX,
                orgY + 17,
                {
                    width: 250,
                    align: "center",
                }
            );

            doc.fontSize(h2).text(
                `REPORTE DE CAJA BANCO`,
                (doc.page.width - orgX - orgY) / 3,
                cabeceraY,
                {
                    width: 250,
                    align: "center",
                }
            );

            doc.fontSize(h3).opacity(0.7).text(
                "INFORMACIÓN",
                doc.options.margins.top,
                doc.y + 20
            );

            doc.opacity(1).fill("#000000");

            let filtroY = doc.y;

            // left
            doc.fontSize(h3).text(
                `Caja / Banco: ${cabecera.nombre}`,
                doc.options.margins.left,
                filtroY + 4
            );
            doc.fontSize(h3).text(
                `Moneda: ${cabecera.moneda}`,
                doc.options.margins.left,
                filtroY + 20
            );

            // right
            doc.fontSize(h3).text(
                `Tipo de cuenta: ${cabecera.tipoCuenta}`,
                medioX + 15,
                filtroY + 4
            );
            doc.fontSize(h3).text(
                `Saldo: ${numberFormat(cabecera.saldo, cabecera.codiso)}`,
                medioX + 15,
                filtroY + 20
            );

            let content = data.lista.map((item, index) => {

                let salida = item.salida <= 0 ? '' : `- ${item.salida}`;
                let ingreso = item.ingreso <= 0 ? '' : `+ ${item.ingreso}`;

                return [item.fecha, item.proveedor, item.cuenta, salida, ingreso]
            })

            // content.push(["", "", "", "TOTAL", "S/ 20.00"]);

            //Tabla
            const table = {
                // title: "Detalle",
                subtitle: "DETALLE DE OPERACIONES",
                headers: ["Fecha", "Proveedor", "Concepto", "Salidas", "Entradas"],
                rows: content
            };

            doc.table(table, {
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(h3),
                prepareRow: () => {
                    doc.font("Helvetica").fontSize(h3);
                },
                padding: 5,
                columnSpacing: 5,
                x: orgX,
                y: doc.y + 10,
                width: doc.page.width - doc.options.margins.left - doc.options.margins.right
            });

            doc.end();

            return getStream.buffer(doc);
        } catch (error) {
            return "Se genero un error al generar el reporte.";
        }
    }

}

module.exports = RepFinanciero;