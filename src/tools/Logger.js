const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const transport = new DailyRotateFile({
    level: 'info',
    filename: 'logs/log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m', 
    maxFiles: '5d',
    format: winston.format.json(),
});

// Configurar el logger
const logger = winston.createLogger({
    transports: [
        transport,
    ]
});

if (process.env.ENVIRONMENT === 'development') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}

module.exports = logger;