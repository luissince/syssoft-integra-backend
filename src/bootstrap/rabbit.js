const RabbitMQ = require('../common/rabbitmq');
const logger = require('../tools/Logger');

module.exports = async function initializeRabbit() {
    try {
        // iniciar conexión con RabbitMQ
        await RabbitMQ.connect();

        logger.info('✅ RabbitMQ conectado');

        // consumers
        await require(
            '../common/consumers/catalog.consumer'
        )();
    } catch (error) {
        logger.warn('⚠️ RabbitMQ no disponible', error);
    }
};