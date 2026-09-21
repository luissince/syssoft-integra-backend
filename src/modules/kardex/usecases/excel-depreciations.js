const ExcelJS = require('exceljs');
const { getYear } = require('../../../tools/Tools');

module.exports = ({ conec }) => async function excelDepreciacions(data) {

    const fechaInicial = getYear(data.fechaInicial);
    const fechaFinal = getYear(data.fechaFinal);

    if (!fechaInicial || !fechaFinal) {
        throw new Error(
            'fechaInicial y fechaFinal deben contener una fecha válida'
        );
    }

    const result = await conec.query(`
        SELECT
            ad.idProducto,
            ad.serie,
            ad.numeracion,
            ia.correlativo,
            ia.fechaAdquisicion,
            ia.fecha as fechaIngreso,
            ad.periodo,
            ad.dias,
            ia.vidaUtil,
            ad.costoFijo,
            ad.valorInicio,
            ad.enero,
            ad.febrero,
            ad.marzo,
            ad.abril,
            ad.mayo,
            ad.junio,
            ad.julio,
            ad.agosto,
            ad.septiembre,
            ad.octubre,
            ad.noviembre,
            ad.diciembre,
            ad.depreciacion,
            ad.depreciacionAcumulada,
            ad.valorLibros
        FROM activoDepreciacion ad
        INNER JOIN inventarioActivo ia
            ON ia.idInventarioActivo = ad.idInventarioActivo
        WHERE YEAR(ad.periodo) BETWEEN ? AND ?
    `, [
        fechaInicial,
        fechaFinal
    ]);

    const workbook = new ExcelJS.Workbook();

    const worksheet = workbook.addWorksheet('Depreciación');

    // =========================
    // ENCABEZADOS
    // =========================

    worksheet.mergeCells('A1:A3');
    worksheet.getCell('A1').value = 'TA';

    worksheet.mergeCells('B1:D2');
    worksheet.getCell('B1').value = 'FECHA';

    worksheet.mergeCells('E1:E3');
    worksheet.getCell('E1').value = 'TD';

    worksheet.mergeCells('F1:G2');
    worksheet.getCell('F1').value = 'DOCUMENTO';

    worksheet.mergeCells('H1:H3');
    worksheet.getCell('H1').value = 'CODIGO INVENTARIO';

    worksheet.mergeCells('I1:J2');
    worksheet.getCell('I1').value = 'COSTO HISTÓRICO';

    worksheet.mergeCells('K1:K3');
    worksheet.getCell('K1').value = 'VALOR NETO EN LIBROS';

    worksheet.mergeCells('L1:AA1');
    worksheet.getCell('L1').value = 'DEPRECIACION';

    worksheet.mergeCells('L2:L3');
    worksheet.getCell('L2').value = '%';

    worksheet.mergeCells('M2:M3');
    worksheet.getCell('M2').value = 'DIAS';

    worksheet.mergeCells('N2:N3');
    worksheet.getCell('N2').value = 'DEPRECIACION ACUMULADA';

    worksheet.mergeCells('O2:O3');
    worksheet.getCell('O2').value = 'DEPRECIACION DEL EJERCICIO';

    worksheet.mergeCells('P2:AA2');
    worksheet.getCell('P2').value = 'MESES';

    // Tercer nivel
    worksheet.getCell('B3').value = 'ADQUISIC';
    worksheet.getCell('C3').value = 'INGRESO';
    worksheet.getCell('D3').value = 'FECHA DE USO';

    worksheet.getCell('F3').value = 'SERIE';
    worksheet.getCell('G3').value = 'N°';

    worksheet.getCell('I3').value = 'DOLARES';
    worksheet.getCell('J3').value = 'SOLES';

    worksheet.getCell('P3').value = 'ENERO';
    worksheet.getCell('Q3').value = 'FEBRERO';
    worksheet.getCell('R3').value = 'MARZO';
    worksheet.getCell('S3').value = 'ABRIL';
    worksheet.getCell('T3').value = 'MAYO';
    worksheet.getCell('U3').value = 'JUNIO';
    worksheet.getCell('V3').value = 'JULIO';
    worksheet.getCell('W3').value = 'AGOSTO';
    worksheet.getCell('X3').value = 'SEPTIEMBRE';
    worksheet.getCell('Y3').value = 'OCTUBRE';
    worksheet.getCell('Z3').value = 'NOVIEMBRE';
    worksheet.getCell('AA3').value = 'DICIEMBRE';

    // =========================
    // ESTILOS ENCABEZADO
    // =========================

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 3) {
            row.eachCell((cell) => {
                cell.font = {
                    bold: true,
                    size: 10
                };

                cell.alignment = {
                    horizontal: 'center',
                    vertical: 'middle',
                    wrapText: true
                };

                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        }
    });

    worksheet.getRow(1).height = 25;
    worksheet.getRow(2).height = 25;
    worksheet.getRow(3).height = 40;

    // =========================
    // DATOS
    // =========================

    for (const inventario of result) {

        worksheet.addRow([
            inventario.correlativo
                ? inventario.correlativo.substring(0, 2)
                : '',

            inventario.fechaAdquisicion
                ? new Date(inventario.fechaAdquisicion)
                : null,

            inventario.fechaIngreso
                ? new Date(inventario.fechaIngreso)
                : null,

            '',

            '',

            inventario.serie,

            inventario.numeracion || 'NA',

            inventario.correlativo,

            '',

            inventario.costoFijo,

            inventario.valorLibros,

            inventario.vidaUtil
                ? 100 / inventario.vidaUtil
                : 0,

            inventario.dias,

            inventario.depreciacionAcumulada,

            inventario.depreciacion,

            inventario.enero,
            inventario.febrero,
            inventario.marzo,
            inventario.abril,
            inventario.mayo,
            inventario.junio,
            inventario.julio,
            inventario.agosto,
            inventario.septiembre,
            inventario.octubre,
            inventario.noviembre,
            inventario.diciembre
        ]);
    }

    // =========================
    // FORMATOS
    // =========================

    worksheet.getColumn('B').numFmt = 'dd/mm/yyyy';
    worksheet.getColumn('C').numFmt = 'dd/mm/yyyy';

    for (let col = 10; col <= 27; col++) {
        worksheet.getColumn(col).numFmt = '#,##0.00';
    }

    // Porcentaje
    worksheet.getColumn('L').numFmt = '0.00';

    // Bordes de datos
    worksheet.eachRow((row, rowNumber) => {

        if (rowNumber >= 4) {

            row.eachCell((cell) => {

                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };

                cell.alignment = {
                    vertical: 'middle'
                };
            });
        }
    });

    // =========================
    // TOTALES
    // =========================

    const totalRow = worksheet.addRow([]);

    worksheet.mergeCells(`A${totalRow.number}:H${totalRow.number}`);

    worksheet.getCell(`A${totalRow.number}`).value = 'TOTALES';

    worksheet.getCell(`J${totalRow.number}`).value = {
        formula: `SUM(J4:J${totalRow.number - 1})`
    };

    worksheet.getCell(`K${totalRow.number}`).value = {
        formula: `SUM(K4:K${totalRow.number - 1})`
    };

    worksheet.getCell(`N${totalRow.number}`).value = {
        formula: `SUM(N4:N${totalRow.number - 1})`
    };

    worksheet.getCell(`O${totalRow.number}`).value = {
        formula: `SUM(O4:O${totalRow.number - 1})`
    };

    for (let col = 16; col <= 27; col++) {

        const letter = worksheet.getColumn(col).letter;

        worksheet.getCell(`${letter}${totalRow.number}`).value = {
            formula: `SUM(${letter}4:${letter}${totalRow.number - 1})`
        };
    }

    totalRow.eachCell((cell) => {

        cell.font = {
            bold: true
        };

        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };

        cell.numFmt = '#,##0.00';
    });

    // =========================
    // ANCHO COLUMNAS
    // =========================

    const widths = [
        10, // A
        14, // B
        14, // C
        14, // D
        10, // E
        15, // F
        12, // G
        20, // H
        15, // I
        15, // J
        20, // K
        10, // L
        10, // M
        20, // N
        20, // O
        14, // P
        14, // Q
        14, // R
        14, // S
        14, // T
        14, // U
        14, // V
        14, // W
        14, // X
        14, // Y
        14, // Z
        14  // AA
    ];

    widths.forEach((width, index) => {
        worksheet.getColumn(index + 1).width = width;
    });

    return workbook;
};