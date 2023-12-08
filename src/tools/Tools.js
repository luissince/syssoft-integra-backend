const fs = require("fs");

function isNumber(value) {
    return typeof value === 'number';
}

function isEmail(value) {
    const validRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    return value.match(validRegex) != null ? true : false;
}

function isDirectory(file) {
    try {
        let result = fs.lstatSync(file).isDirectory()
        return result;
    } catch (error) {
        return false;
    }
}

function isFile(file) {
    try {
        let result = fs.lstatSync(file).isFile()
        return result;
    } catch (error) {
        return false;
    }
}

function removeFile(file) {
    try {
        fs.unlinkSync(file)
        return true;
    } catch (error) {
        return false;
    }
}

function writeFile(file, data, options = 'base64') {
    try {
        fs.writeFileSync(file, data, options);
    } catch (error) {
    }
}

function mkdir(file) {
    try {
        fs.mkdirSync(file);
    } catch (error) {
    }
}

async function chmod(file, mode = 755) {
    try {
        fs.chmodSync(file, mode);
    } catch (err) {
    }
}

function currentDate() {
    let date = new Date();
    let formatted_date = date.getFullYear() + "-" + ((date.getMonth() + 1) > 9 ? (date.getMonth() + 1) : '0' + (
        date.getMonth() + 1)) + "-" + (date.getDate() > 9 ? date.getDate() : '0' + date.getDate());
    return formatted_date;
}

function currentTime() {
    let time = new Date();
    let formatted_time = (time.getHours() > 9 ? time.getHours() : '0' + time.getHours()) + ":" + (time.getMinutes() > 9 ? time.getMinutes() : '0' + time.getMinutes()) + ":" + (time.getSeconds() > 9 ? time.getSeconds() : '0' + time.getSeconds());
    return formatted_time;
}

function dateFormat(value) {
    var parts = value.split("-");
    let today = new Date(parts[0], parts[1] - 1, parts[2]);
    return (
        (today.getDate() > 9 ? today.getDate() : "0" + today.getDate()) +
        "/" +
        (today.getMonth() + 1 > 9
            ? today.getMonth() + 1
            : "0" + (today.getMonth() + 1)) +
        "/" +
        today.getFullYear()
    );
}

function formatMoney(amount, decimalCount = 2, decimal = ".", thousands = "") {
    try {
        // Asegurarse de que decimalCount sea un número positivo
        decimalCount = Math.max(0, decimalCount);

        // Convertir el amount a un número con la cantidad de decimales especificada
        const numericAmount = Number(amount) || 0;
        const formattedAmount = numericAmount.toFixed(decimalCount);

        // Separar la parte entera de la decimal
        const [integerPart, decimalPart] = formattedAmount.split(".");

        // Agregar separadores de miles
        let integerFormatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);

        // Combinar la parte entera y la decimal con el punto decimal
        const result = decimalPart ? `${integerFormatted}${decimal}${decimalPart}` : integerFormatted;

        // Manejar números negativos
        return numericAmount < 0 ? `-${result}` : result;
    } catch (e) {
        return "0"; // Manejar errores devolviendo "0"
    }
}

function numberFormat(value, currency = "PEN") {
    let formats = [
        {
            locales: "es-PE",
            options: {
                style: "currency",
                currency: "PEN",
                minimumFractionDigits: 2,
            },
        },
        {
            locales: "en-US",
            options: {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 2,
            },
        },
        {
            locales: "de-DE",
            options: {
                style: "currency",
                currency: "EUR",
                minimumFractionDigits: 2,
            },
        },
    ];

    let newFormat = formats.filter((item) => currency === item.options.currency);
    if (newFormat.length > 0) {
        var formatter = new Intl.NumberFormat(newFormat[0].locales, {
            style: newFormat[0].options.style,
            currency: newFormat[0].options.currency,
        });
        return formatter.format(value);
    } else {
        return 0;
    }
}

function calculateTaxBruto(impuesto, monto) {
    return monto / ((impuesto + 100) * 0.01);
}

function calculateTax(porcentaje, valor) {
    let igv = parseFloat(porcentaje) / 100.0;
    return valor * igv;
}

function frecuenciaPago(value) {
    if (value === 7) return "SEMANAL";
    if (value === 15) return "QUINCENAL";
    if (value === 30) return "MENSUAL";
    if (value === 60) return "BIMESTRAL";
    if (value === 90) return "TRIMESTRAL";
    return "NINGUNO";
}

function zfill(number, width = 6) {
    var numberOutput = Math.abs(number);
    var length = number.toString().length;
    var zero = "0";

    if (width <= length) {
        if (number < 0) {
            return ("-" + numberOutput.toString());
        } else {
            return numberOutput.toString();
        }
    } else {
        if (number < 0) {
            return ("-" + (zero.repeat(width - length)) + numberOutput.toString());
        } else {
            return ((zero.repeat(width - length)) + numberOutput.toString());
        }
    }
}

function categoriaProducto(producto, categoria) {
    return producto + " - " + categoria;
}

function generateAlphanumericCode(idCode, lista, propiedad) {
    if (lista.length === 0) return idCode

    const quitarValor = lista.map(item => parseInt(item[propiedad].replace(/[A-Z]+/g, '')));
    const incremental = Math.max(...quitarValor) + 1;
    const formattedIncremental = String(incremental).padStart(4, '0');
    return `${idCode.slice(0, 2)}${formattedIncremental}`;
}

function generateNumericCode(idCode, lista, propiedad) {
    if (lista.length === 0) return idCode

    const quitarValor = lista.map(item => parseInt(item[propiedad]));
    return Math.max(...quitarValor) + 1;
}

module.exports = {
    isNumber,
    currentDate,
    currentTime,
    dateFormat,
    formatMoney,
    calculateTaxBruto,
    calculateTax,
    numberFormat,
    frecuenciaPago,
    zfill,
    isDirectory,
    isFile,
    removeFile,
    writeFile,
    mkdir,
    chmod,
    categoriaProducto,
    isEmail,
    generateAlphanumericCode,
    generateNumericCode
};