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
const logger = require('./Logger');

/**
 * Formatea un número agregando ceros delante hasta alcanzar una longitud específica.
 *
 * @param {number} numero - El número que se va a formatear.
 * @returns {string} El número formateado con ceros delante.
 */
function formatNumberWithZeros(numero) {
    // Convierte el número a cadena y maneja números negativos
    const numeroAbsoluto = Math.abs(numero);
    const numeroFormateado = String(numeroAbsoluto).padStart(6, '0');

    // Añade el signo negativo si el número original era negativo
    return numero < 0 ? `-${numeroFormateado}` : numeroFormateado;
}

/**
 * Verifica si el valor es un número.
 * 
 * @param {*} value 
 * @returns 
 */
function isNumber(value) {
    return typeof value === 'number';
}

/**
 * Varifica si el valor es un email.
 * 
 * @param {*} value 
 * @returns 
 */
function isEmail(value) {
    const validRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    return value.match(validRegex) != null ? true : false;
}

/**
 * Verifica si el archivo es un directorio.
 * 
 * @param {*} file 
 * @returns 
 */
async function isDirectory(file) {
    try {
        const stats = await lstatAsync(file);
        return stats.isDirectory();
    } catch (error) {
        return false;
    }
}

/**
 * Verifica si el archivo es un archivo.
 * 
 * @param {*} file 
 * @returns 
 */
async function isFile(file) {
    try {
        const stats = await lstatAsync(file);
        return stats.isFile();
    } catch (error) {
        return false;
    }
}

/**
 * Elimina un archivo.
 * 
 * @param {*} file 
 * @returns 
 */
async function removeFile(file) {
    if (fs.existsSync(file)) {
        await unlinkFileAsync(file);
    }
}

/**
 * Escribe un archivo.
 * 
 * @param {*} file 
 * @param {*} data 
 * @param {*} options 
 * @returns 
 */
async function writeFile(file, data, options = 'base64') {
    try {
        await writeFileAsync(file, data, options);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Crea un directorio.
 * 
 * @param {*} file 
 * @returns 
 */
async function mkdir(file) {
    try {
        await mkdirAsync(file);
    } catch (error) {
        // Manejar el error si es necesario
    }
}

/**
 * Cambia el modo de un archivo.
 * 
 * @param {*} file 
 * @param {*} mode 
 * @returns 
 */
async function chmod(file, mode = 0o755) {
    try {
        await chmodAsync(file, mode);
    } catch (error) {
        // Manejar el error si es necesario
    }
}

/**
 * Obtiene la fecha actual en formato "YYYY-MM-DD".
 * @returns {string} La fecha actual en formato "YYYY-MM-DD".
 */
function currentDate() {
    const date = new Date(); // Obtiene la fecha actual
    // Formatea la fecha como "YYYY-MM-DD"
    const formatted_date = date.getFullYear() + "-" + ((date.getMonth() + 1) > 9 ? (date.getMonth() + 1) : '0' + (
        date.getMonth() + 1)) + "-" + (date.getDate() > 9 ? date.getDate() : '0' + date.getDate());
    return formatted_date; // Retorna la fecha formateada
}

/**
 * Obtiene la hora actual en formato "HH:MM:SS".
 * @returns {string} La hora actual en formato "HH:MM:SS".
 */
function currentTime() {
    const time = new Date(); // Obtiene la hora actual
    // Formatea la hora como "HH:MM:SS"
    const formatted_time = (time.getHours() > 9 ? time.getHours() : '0' + time.getHours()) + ":" + (time.getMinutes() > 9 ? time.getMinutes() : '0' + time.getMinutes()) + ":" + (time.getSeconds() > 9 ? time.getSeconds() : '0' + time.getSeconds());
    return formatted_time; // Retorna la hora formateada
}

/**
 * 
 * 
 * @param {*} value 
 * @returns 
 */
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

/**
 * Procesa un archivo PKCS#12 (.p12 / .pfx), extrae el certificado y la clave privada
 * en formato PEM, y devuelve información relevante del certificado.
 *
 * Flujo general:
 * 1. Verifica si existe un nuevo archivo para procesar.
 * 2. Elimina el archivo anterior si existe.
 * 3. Guarda el nuevo archivo codificado en base64.
 * 4. Lee y parsea el archivo PKCS#12 usando node-forge.
 * 5. Extrae:
 *    - Clave privada
 *    - Certificado
 * 6. Convierte ambos a formato PEM.
 * 7. Devuelve la información del certificado y fechas de validez.
 *
 * @async
 * @function processFilePem
 *
 * @param {string} fileDirectory
 * Directorio donde se almacenará el archivo.
 *
 * @param {string} file
 * Contenido del archivo codificado en base64.
 * Si viene vacío (''), se devuelve la información existente sin procesar nada.
 *
 * @param {string} name
 * Nombre base que tendrá el archivo guardado.
 *
 * @param {string} ext
 * Extensión del archivo (ejemplo: p12 o pfx).
 *
 * @param {string} password
 * Contraseña del certificado PKCS#12.
 *
 * @param {string|null} existingFile
 * Nombre del archivo anterior almacenado.
 * Si existe, será eliminado antes de guardar el nuevo.
 *
 * @param {string|null} certificate
 * Certificado PEM previamente almacenado.
 * Se devuelve cuando no se envía un nuevo archivo.
 *
 * @param {string|null} private
 * Clave privada PEM previamente almacenada.
 * Se devuelve cuando no se envía un nuevo archivo.
 *
 * @returns {Promise<Object>}
 * Retorna un objeto con:
 *
 * @returns {string} returns.nombre
 * Nombre final del archivo guardado.
 *
 * @returns {string} returns.certificate
 * Certificado en formato PEM.
 *
 * @returns {string} returns.private
 * Clave privada en formato PEM.
 *
 * @returns {string} returns.startDateTime
 * Fecha de inicio de validez del certificado (YYYY-MM-DD HH:mm:ss).
 *
 * @returns {string} returns.expirationDateTime
 * Fecha de expiración del certificado (YYYY-MM-DD HH:mm:ss).
 *
 *
 * @throws {Error}
 * Lanza un error cuando:
 * - El archivo PKCS#12 es inválido.
 * - La contraseña es incorrecta.
 * - No existe una clave privada dentro del archivo.
 * - Ocurre un problema al leer/escribir archivos.
 */
async function processFilePem(fileDirectory, file, name, ext, password, existingFile, certificate, private) {
    // Verificar si hay un archivo para procesar
    if (file === '') {
        // Si no hay archivo, devolver el nombre del archivo existente
        return {
            "nombre": existingFile,
            "certificate": certificate,
            "private": private
        }
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
        const privateKeyPem = forge.pki.privateKeyInfoToPem(
            forge.pki.wrapRsaPrivateKey(
                forge.pki.privateKeyToAsn1(privateKey)
            )
        );
        const certPem = forge.pki.certificateToPem(cert);


        // Devolver la información procesada
        return {
            "nombre": nameFile,
            "certificate": certPem,
            "private": privateKeyPem,
            "startDateTime": cert.validity.notBefore || null,
            "expirationDateTime": cert.validity.notAfter || null,
        }
    } catch (error) {
        throw new Error(error.message);
    }
}

/**
 * Obtiene información de validez desde un certificado PEM.
 *
 * @param {string} certificatePem
 * Certificado en formato PEM:
 * -----BEGIN CERTIFICATE-----
 *
  * @returns {Object}
 * Retorna un objeto con:
 * 
 * @returns {string} returns.startDateTime
 * Fecha de inicio de validez del certificado (YYYY-MM-DD HH:mm:ss).
 *
 * @returns {string} returns.expirationDateTime
 * Fecha de expiración del certificado (YYYY-MM-DD HH:mm:ss).
 * 
  * @throws {Error}
 * Lanza un error cuando:
 * - El certificado PEM es inválido.
 */
function getCertificateDates(certificatePem) {

    if (!certificatePem) {
        return {
            startDateTime: null,
            expirationDateTime: null,
        }
    }

    try {
        // Convertir PEM a objeto certificado
        const cert = forge.pki.certificateFromPem(certificatePem);

        return {
            startDateTime: cert.validity.notBefore,
            expirationDateTime: cert.validity.notAfter,
        };
    } catch (error) {
        throw new Error(
            `Error al procesar el certificado PEM: ${error.message}`
        );
    }
}

/**
 * Procesa y guarda un archivo en el directorio especificado.
 *
 * Flujo:
 * 1. Verifica si existe contenido para procesar.
 * 2. Genera el nombre final del archivo.
 * 3. Elimina el archivo anterior si existe.
 * 4. Guarda el nuevo archivo en formato base64.
 *
 * @param {string} fileDirectory Directorio donde se almacenará el archivo.
 * @param {string} file Contenido del archivo en base64.
 * @param {string} name Nombre del archivo.
 * @param {string} ext Extensión del archivo.
 *
 * @returns {Promise<string|null>}
 * Retorna el nombre del archivo generado o null si no se procesó.
 */
async function processFile(fileDirectory, file, name, ext) {
    /**
      * Validar contenido del archivo.
      */
    if (!file || file === '') {
        return null;
    }

    /**
     * Validar nombre y extensión.
     */
    if (!name) {
        throw new Error(
            'El nombre del archivo es requerido.'
        );
    }

    if (!ext) {
        throw new Error(
            'La extensión del archivo es requerida.'
        );
    }

    /**
    * Crear nombre y ruta final.
    */
    const nameFile = `${name}.${ext}`;

    const filePath = path.join(
        fileDirectory,
        nameFile
    );

    try {
        /**
        * Eliminar archivo anterior si existe.
        */
        await removeFile(filePath);

        /**
        * Guardar nuevo archivo.
        */
        await writeFileAsync(
            filePath,
            file,
            'base64'
        );

        /**
         * Retornar nombre generado.
         */
        return nameFile;
    } catch (error) {
        throw new Error(error.message);
    }
}

/**
 * Procesa un archivo en Firebase Storage.
 *
 * Casos:
 * - Eliminar archivo.
 * - Mantener archivo actual.
 * - Actualizar archivo.
 *
 * @param {object} bucket Bucket de Firebase.
 * @param {object} fileData Información del archivo.
 * @param {string|null} currentFile Ruta actual almacenada.
 * @param {string} folderName Carpeta donde guardar.
 * @param {string|null} filePrefix Prefijo opcional para el nombre del archivo.
 *
 * @returns {Promise<string|null>}
 * Ruta final del archivo o null.
 */
async function processFirebaseFile(
    bucket,
    fileData,
    currentFile,
    folderName,
    filePrefix
) {

    /**
     * Validar existencia de bucket.
     */
    if (!bucket) {
        return currentFile ?? null;
    }

    /**
     * Validar información del archivo.
     */
    if (!fileData) {
        return currentFile ?? null;
    }

    /**
     * Caso:
     * Eliminar archivo existente.
     */
    if (
        fileData.nombre === undefined &&
        fileData.base64 === undefined
    ) {

        if (currentFile) {

            const file = bucket.file(currentFile);

            try {
                await file.delete();
            } catch (_) { }
        }

        return null;
    }

    /**
     * Caso:
     * Subir nuevo archivo.
     */
    if (fileData.base64 !== undefined) {

        /**
         * Eliminar archivo anterior.
         */
        if (currentFile) {

            const oldFile = bucket.file(currentFile);

            try {
                const [exists] = await oldFile.exists();

                if (exists) {
                    await oldFile.delete();
                }
            } catch (_) { }
        }

        /**
         * Crear buffer.
         */
        const buffer = Buffer.from(
            fileData.base64,
            'base64'
        );

        /**
         * Generar nombre único.
         */
        const timestamp = Date.now();

        const uniqueId = Math.random()
            .toString(36)
            .substring(2, 9);

        const safeFilePrefix = filePrefix
            ? filePrefix.replace(/[^a-zA-Z0-9_-]/g, '')
            : '';

        const prefix = safeFilePrefix
            ? `${safeFilePrefix}_`
            : '';

        const fileName =
            `${prefix}${timestamp}_${uniqueId}.${fileData.extension}`;

        /**
         * Ruta final.
         */
        const filePath =
            `${folderName}/${fileName}`;

        /**
         * Subir archivo.
         */
        const file = bucket.file(filePath);

        await file.save(buffer, {
            metadata: {
                contentType:
                    'image/' + fileData.extension,
            }
        });

        /**
         * Hacer público.
         */
        await file.makePublic();

        return filePath;
    }

    /**
     * Mantener archivo actual.
     */
    return fileData.nombre ?? null;
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

function registerLog(nameFunction, error) {
    if (!error || !error.message) {
        logger.error(`${nameFunction}: Error de conexión intero.`);
    } else {
        logger.error(`${nameFunction}: ${error.message ?? error}`);
    }
}

function responseSSE(req, res, callback) {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
        async start(controller) {
            let connectionActive = true;

            const sendEvent = (data) => {
                const message = `data: ${JSON.stringify(data)}\n\n`;
                controller.enqueue(encoder.encode(message));
            };

            callback(sendEvent).catch(() => {
                if (connectionActive)
                    controller.close();
            });

            req.on('close', () => {
                connectionActive = false;
                controller.close();
            });
        }
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    body.pipeTo(new WritableStream({
        write(chunk) {
            res.write(chunk);
        },
        close() {
            res.end();
        },
        abort(err) {
            res.end();
        }
    }));
};

function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
};

module.exports = {
    formatNumberWithZeros,
    isNumber,
    currentDate,
    currentTime,
    dateFormat,
    processFirebaseFile,
    formatMoney,
    numberFormat,
    isDirectory,
    isFile,
    removeFile,
    writeFile,
    mkdir,
    chmod,
    isEmail,
    generateAlphanumericCode,
    generateNumericCode,
    processImage,
    getCertificateDates,
    processFilePem,
    processFile,
    rounded,
    registerLog,
    responseSSE,
    sleep
};