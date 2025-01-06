const logger = require('./Logger');

/**
* Esta función se encarga de resporder las peticiones exitosas con estado 200 http. 
* @author Luis Alexander Lara <https://www.facebook.com/luisal.laras>
*
* @param {import('express').Response} res - El objeto de respuesta (Response).
* @param {object} result El objeto de respuesta de la petición
* @returns {object} Retorna 
*     res.send(new Buffer('wahoo'));
*     res.send({ some: 'json' });
*     res.send('<p>some html</p>');
*     res.status(200).send('Sorry, cant find that');
*/
function sendSuccess(res, result) {
    return res.status(200).send(result);
}

/**
 * Envía un archivo PDF como respuesta a una solicitud HTTP.
 * 
 * @param {import('express').Response} res - El objeto de respuesta de Express.
 * @param {Buffer} buffer - Los datos del PDF que se enviarán como respuesta.
 * @returns {import('express').Response} - El objeto de respuesta modificado con el PDF adjunto.
 * 
 * @example
 * // Envia los datos del PDF como respuesta
 * sendPdf(res, data);
 */
function sendPdf(res, buffer, fileName = "reporte") {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + fileName + '.pdf"');
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
}

/**
 * Envía un archivo PDF como respuesta a una solicitud HTTP.
 * 
 * @param {import('express').Response} res - El objeto de respuesta de Express.
 * @param {Response} response - Objeto responde
 * @param {string} [fileName="reporte"] - El nombre del archivo que se enviará como respuesta.
 * @returns {import('express').Response} - El objeto de respuesta modificado con el PDF adjunto.
 * 
 * @example
 * // Envia los datos del PDF como respuesta
 * sendFile(res, response);
 */
function sendFile(res, response, fileName) {
    // Extraer el tipo de archivo (MIME type) de la respuesta
    const contentType = response.headers['content-type'];

    // Extraer el nombre del archivo de la cabecera Content-Disposition
    const contentDisposition = response.headers['content-disposition'];
    const filename = fileName ?? contentDisposition.match(/filename=([^;]+)/)[1].trim();

    // Configurar las cabeceras de respuesta
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', response.data.length);

    // Enviar el archivo al cliente
    return res.end(response.data);
}

/**
* Esta función se encarga de resporder las peticiones registradas con estado 201 http. 
* @author Luis Alexander Lara <https://www.facebook.com/luisal.laras>
*
* @param {import('express').Response} res - El objeto de respuesta (Response).
* @param {object} result El objeto de respuesta de la petición
* @returns {object} Retorna 
*     res.send(new Buffer('wahoo'));
*     res.send({ some: 'json' });
*     res.send('<p>some html</p>');
*     res.status(201).send('Sorry, cant find that');
*/
function sendSave(res, result) {
    return res.status(201).send(result);
}

/**
* Esta función se encarga de resporder las peticiones exitosas sin contenido con estado 204 http. 
* @author Luis Alexander Lara <https://www.facebook.com/luisal.laras>
*
* @param {import('express').Response} res - El objeto de respuesta (Response).
* @param {object} result El objeto de respuesta de la petición
* @returns {object} Retorna 
*     res.send(new Buffer('wahoo'));
*     res.send({ some: 'json' });
*     res.send('<p>some html</p>');
*     res.status(204).send('Sorry, cant find that');
*/
function sendNoContent(res, result) {
    return res.status(204).send(result);
}

/**
 * Envía una respuesta de error HTTP 500.
 * @author Luis Alexander Lara
 *
 * @param {import('express').Response} res - El objeto de respuesta (Response) de Express.
 * @param {string} [result="Se produjo un error de servidor, intente nuevamente."] - El mensaje de error a enviar.
 * @param {string} title - El título o contexto del error.
 * @param {Error} [error] - El error capturado, si está disponible.
 * @returns {import('express').Response} - La respuesta HTTP 500 con el mensaje de error.
 */
function sendError(res, result = "Se produjo un error de servidor, intente nuevamente.", title, error) {
    console.log(error)

    if (!error || !error.message) {
        logger.error(`${title}: ${error}`);
    } else {
        logger.error(`${title}: ${error.message ?? error}`);
    }
    return res.status(500).send(result);
}

/**
* Esta función se encarga de resporder las peticiones de error del cliente con estado 400 http. 
* @author Luis Alexander Lara <https://www.facebook.com/luisal.laras>
*
* @param {import('express').Response} res - El objeto de respuesta (Response).
* @param {object} result El objeto de respuesta de la petición
* @returns {object} Retorna 
*     res.send(new Buffer('wahoo'));
*     res.send({ some: 'json' });
*     res.send('<p>some html</p>');
*     res.status(400).send('Sorry, cant find that');
*/
function sendClient(res, result) {
    return res.status(400).send(result);
}

/**
*Esta función se encarga de resporder las peticiones que no tiene autorización con estado 401 http. 
*@author Luis Alexander Lara <https://www.facebook.com/luisal.laras>
*
* @param {import('express').Response} res - El objeto de respuesta (Response).
* @param {object} result El objeto de respuesta de la petición
* @returns {object} Retorna 
*     res.send(new Buffer('wahoo'));
*     res.send({ some: 'json' });
*     res.send('<p>some html</p>');
*     res.status(401).send('Sorry, cant find that');
*/
function sendNoAutorizado(res, result) {
    return res.status(401).send(result);
}


/**
* Esta función se encarga de resporder las peticiones expiradas 403 http. 
* @author Luis Alexander Lara <https://www.facebook.com/luisal.laras>
*
* @param {import('express').Response} res - El objeto de respuesta (Response).
* @param {object} result El objeto de respuesta de la petición
* @returns {object} Retorna 
*     res.send(new Buffer('wahoo'));
*     res.send({ some: 'json' });
*     res.send('<p>some html</p>');
*     res.status(403).send('Sorry, cant find that');
*/
function sendExpired(res, result) {
    return res.status(403).send(result);
}

/**
* Esta función se encarga de resporder las peticiones no encontradas 404 http. 
* @author Luis Alexander Lara <https://www.facebook.com/luisal.laras>
*
* @param {import('express').Response} res - El objeto de respuesta (Response).
* @param {object} result El objeto de respuesta de la petición
* @returns {object} Retorna 
*     res.send(new Buffer('wahoo'));
*     res.send({ some: 'json' });
*     res.send('<p>some html</p>');
*     res.status(404).send('Sorry, cant find that');
*/
function sendNotFound(res, result) {
    return res.status(404).send(result);
}

module.exports = {
    sendSuccess,
    sendPdf,
    sendFile,
    sendSave,
    sendError,
    sendClient,
    sendNoContent,
    sendExpired,
    sendNoAutorizado,
    sendNotFound
};