const logger = require('../tools/Logger');
module.exports = (req, res, next) => {
    logger.info(' Peticion recibida:');

    logger.info(`Método: ${req.method}`);
    logger.info(`URL: ${req.url}`);
    logger.info(`Body:`);
    logger.info(JSON.stringify(req.body));
    logger.info(`Headers:`);
    logger.info(JSON.stringify(req.headers))
    logger.info(`Params:`);
    logger.info(JSON.stringify(req.params));
    logger.info(`Query:`);
    logger.info(JSON.stringify(req.query));
    logger.info(`\n`);

    next();
};