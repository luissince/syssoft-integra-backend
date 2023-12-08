
/**
*Esta función se encarga de resporder las peticiones exitosas con estado 200 http. 
*@author Luis Alexander Lara <https://www.facebook.com/luisal.laras>
*
*@param {object} res El objeto de respuesta del request
*@param {object} result El objeto de respuesta de la petición
*@returns {object} Retorna 
*     res.send(new Buffer('wahoo'));
*     res.send({ some: 'json' });
*     res.send('<p>some html</p>');
*     res.status(200).send('Sorry, cant find that');
*/
function sendSuccess(res, result) {
    return res.status(200).send(result);
}

/**
*Esta función se encarga de resporder las peticiones registradas con estado 201 http. 
*@author Luis Alexander Lara <https://www.facebook.com/luisal.laras>
*
*@param {object} res El objeto de respuesta del request
*@param {object} result El objeto de respuesta de la petición
*@returns {object} Retorna 
*     res.send(new Buffer('wahoo'));
*     res.send({ some: 'json' });
*     res.send('<p>some html</p>');
*     res.status(201).send('Sorry, cant find that');
*/
function sendSave(res, result) {
    return res.status(201).send(result);
}

/**
*Esta función se encarga de resporder las peticiones exitosas sin contenido con estado 204 http. 
*@author Luis Alexander Lara <https://www.facebook.com/luisal.laras>
*
*@param {object} res El objeto de respuesta del request
*@param {object} result El objeto de respuesta de la petición
*@returns {object} Retorna 
*     res.send(new Buffer('wahoo'));
*     res.send({ some: 'json' });
*     res.send('<p>some html</p>');
*     res.status(204).send('Sorry, cant find that');
*/
function sendNoContent(res, result) {
    return res.status(204).send(result);
}

/**
*Esta función se encarga de resporder las peticiones fallidas con estado 500 http. 
*@author Luis Alexander Lara <https://www.facebook.com/luisal.laras>
*
*@param {object} res El objeto de respuesta del request
*@param {object} result{"Se produjo un error de servidor, intente nuevamente."} El objeto de respuesta de la petición
*@returns {object} Retorna 
*     res.send(new Buffer('wahoo'));
*     res.send({ some: 'json' });
*     res.send('<p>some html</p>');
*     res.status(500).send('Sorry, cant find that');
*/
function sendError(res, result = "Se produjo un error de servidor, intente nuevamente.") {
    return res.status(500).send(result);
}

/**
*Esta función se encarga de resporder las peticiones de error del cliente con estado 400 http. 
*@author Luis Alexander Lara <https://www.facebook.com/luisal.laras>
*
*@param {object} res El objeto de respuesta del request
*@param {object} result El objeto de respuesta de la petición
*@returns {object} Retorna 
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
*@param {object} res El objeto de respuesta del request
*@param {object} result El objeto de respuesta de la petición
*@returns {object} Retorna 
*     res.send(new Buffer('wahoo'));
*     res.send({ some: 'json' });
*     res.send('<p>some html</p>');
*     res.status(401).send('Sorry, cant find that');
*/
function sendNoAutorizado(res, result) {
    return res.status(401).send(result);
}


/**
*Esta función se encarga de resporder las peticiones expiradas 403 http. 
*@author Luis Alexander Lara <https://www.facebook.com/luisal.laras>
*
*@param {object} res El objeto de respuesta del request
*@param {object} result El objeto de respuesta de la petición
*@returns {object} Retorna 
*     res.send(new Buffer('wahoo'));
*     res.send({ some: 'json' });
*     res.send('<p>some html</p>');
*     res.status(403).send('Sorry, cant find that');
*/
function sendExpired(res, result) {
    return res.status(403).send(result);
}

/**
*Esta función se encarga de resporder las peticiones no encontradas 404 http. 
*@author Luis Alexander Lara <https://www.facebook.com/luisal.laras>
*
*@param {object} res El objeto de respuesta del request
*@param {object} result El objeto de respuesta de la petición
*@returns {object} Retorna 
*     res.send(new Buffer('wahoo'));
*     res.send({ some: 'json' });
*     res.send('<p>some html</p>');
*     res.status(404).send('Sorry, cant find that');
*/
function sendNotFound(res, result) {
    return res.status(404).send(result);
}

module.exports = { sendSuccess, sendSave, sendError, sendClient, sendNoContent, sendExpired, sendNoAutorizado, sendNotFound };