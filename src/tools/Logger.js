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
    format: winston.format.combine(
        winston.format.splat(),      // <-- Agrega esto
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp }) => {
            return `${new Date(timestamp).toLocaleString()} ${level}: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        transport,
    ]
});


module.exports = logger;