const { promisify } = require('util');
const fs = require("fs");
const path = require("path");
const lstatAsync = promisify(fs.lstat);
const unlinkFileAsync = promisify(fs.unlink);
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);
const chmodAsync = promisify(fs.chmod);
const forge = require('node-forge');

function isNumber(value) {
    return typeof value === 'number';
}

function isEmail(value) {
    const validRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    return value.match(validRegex) != null ? true : false;
}

async function isDirectory(file) {
    try {
        const stats = await lstatAsync(file);
        return stats.isDirectory();
    } catch (error) {
        return false;
    }
}
async function isFile(file) {
    try {
        const stats = await lstatAsync(file);
        return stats.isFile();
    } catch (error) {
        return false;
    }
}

async function removeFile(file) {
    if (fs.existsSync(file)) {
        await unlinkFileAsync(file);
    }
}

async function writeFile(file, data, options = 'base64') {
    try {
        await writeFileAsync(file, data, options);
        return true;
    } catch (error) {
        return false;
    }
}

async function mkdir(file) {
    try {
        await mkdirAsync(file);
    } catch (error) {
        // Manejar el error si es necesario
    }
}

async function chmod(file, mode = 0o755) {
    try {
        await chmodAsync(file, mode);
    } catch (error) {
        // Manejar el error si es necesario
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

async function processImage(fileDirectory, image, ext, existingImage) {
    if (image === '') {
        return existingImage;
    }

    if (existingImage) {
        await removeFile(path.join(fileDirectory, existingImage));
    }

    const timestamp = Date.now();
    const uniqueId = Math.random().toString(36).substring(2, 9);
    const name = `${timestamp}_${uniqueId}.${ext}`;

    await writeFile(path.join(fileDirectory, name), image);

    return name;
}

async function processFilePem(fileDirectory, file, name, ext, password, existingFile) {
    // Verificar si hay un archivo para procesar
    if (file === '') {
        // Si no hay archivo, devolver el nombre del archivo existente
        return existingFile;
    }

    // Crear el nombre del nuevo archivo
    const nameFile = `${name}.${ext}`;

    try {
        // Si hay un archivo existente, eliminarlo
        if (existingFile) {
            await removeFile(path.join(fileDirectory, existingFile));
        }

        // Escribir el archivo en el directorio especificado
        await writeFileAsync(path.join(fileDirectory, nameFile), file, 'base64');

        // Leer el archivo recién creado y procesarlo
        const data = await readFileAsync(path.join(fileDirectory, nameFile));
        const p12Asn1 = forge.asn1.fromDer(data.toString('binary'));
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

        // Extraer la clave privada y el certificado del archivo P12
        const bags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
        if (!bags || bags.length === 0) {
            throw new Error("No se encontró ninguna clave privada en el archivo.");
        }

        const privateKeyBag = bags[forge.pki.oids.pkcs8ShroudedKeyBag][0];
        const privateKey = privateKeyBag.key;

        const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag][0];
        const cert = certBag.cert;

        // Convertir la clave privada y el certificado en formato PEM
        const privateKeyPem = forge.pki.privateKeyInfoToPem(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(privateKey)));
        const certPem = forge.pki.certificateToPem(cert);

        // Escribir la clave privada y el certificado en archivos separados
        // await writeFileAsync(path.join(fileDirectory, "privateKey.pem"), privateKeyPem);
        // await writeFileAsync(path.join(fileDirectory, "certificate.pem"), certPem);

        // Devolver el nombre del archivo procesado
        // return nameFile;
        return {
            "nombre": nameFile,
            "certificate": certPem,
            "private": privateKeyPem
        }
    } catch (error) {
        throw new Error(error.message);
    }
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

function rounded(amount, decimalCount = 2) {
    const isNumber = /^-?\d*\.?\d+$/.test(amount);
    if (!isNumber) return 0;

    decimalCount = Math.abs(decimalCount);
    decimalCount = isNaN(decimalCount) ? 2 : decimalCount;

    const negativeSign = amount < 0 ? '-' : '';

    const parsedAmount = Math.abs(Number(amount)) || 0;
    const fixedAmount = parsedAmount.toFixed(decimalCount);

    return parseFloat(negativeSign + fixedAmount);
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
    generateNumericCode,
    processImage,
    processFilePem,
    rounded
};