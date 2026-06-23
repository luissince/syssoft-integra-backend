const logger = require('../tools/Logger');
module.exports = (req, res, next) => {
    logger.info(' Peticion recibida:');

    logger.info('Método: %s', req.method);
    logger.info('URL: %s', req.url);
    logger.info('Body: %o', req.body);
    logger.info('Headers: %o', req.headers);
    logger.info('Params: %o', req.params);
    logger.info('Query: %o', req.query);

    next();
};