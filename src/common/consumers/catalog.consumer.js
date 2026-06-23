const conec = require('../../database/mysql-connection');
const { CATALOG_PDF_COMPLETED_QUEUE, CATALOG_PDF_COMPLETED_PATTERN } = require('../constants/queues.constants');
const RabbitMQ = require('../rabbitmq');
const logger = require('../../tools/Logger');

module.exports = async () => {
    await RabbitMQ.consume(
        CATALOG_PDF_COMPLETED_QUEUE,
        async (pattern, data) => {
            switch (pattern) {
                case CATALOG_PDF_COMPLETED_PATTERN:
                    logger.info('Recepción de PDF completado');
                    let connection = null;
                    try {
                        connection = await conec.beginTransaction();

                        await conec.execute(connection, `
                        UPDATE
                            catalogo 
                        SET
                            pdfKey = ?,
                            pdfEstado = ?
                        WHERE
                            idCatalogo = ?`, [
                            data.key,
                            data.status,
                            data.idCatalogo
                        ]);

                        await conec.commit(connection);

                    } catch (error) {
                        if (connection != null) {
                            await conec.rollback(connection);
                        }

                        logger.error('❌ Se produjo un error al actualizar el PDF de la catálogo del consumidor.');
                    }
                    break;
                default:
                    logger.warn(`Pattern desconocido: ${pattern}`);
            }
        }
    );
};