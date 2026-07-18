const logger = require('../tools/Logger');
module.exports = (req, res, next) => {
    logger.info(' Peticion recibida:');

    logger.info(`Método: ${req.method}`);
    logger.info(`URL: ${req.url}`);
    logger.info(`Body: ${JSON.stringify(req.body)}`);
    logger.info(`Headers: ${JSON.stringify(req.headers)}`);
    logger.info(`Params: ${JSON.stringify(req.params)}`);
    logger.info(`Query: ${JSON.stringify(req.query)}`);

    next();
};