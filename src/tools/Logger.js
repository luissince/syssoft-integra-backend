const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");


const onlyLevel = (level) => {
    return winston.format((info) => {
        return info.level === level ? info : false;
    })();
};


const logger = winston.createLogger({

    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ level, message, timestamp, stack }) => {
            return `${new Date(timestamp).toLocaleString()} ${level}: ${stack || message}`;
        })
    ),

    transports: [

        new DailyRotateFile({
            filename: "logs/info-%DATE%.log",
            datePattern: "YYYY-MM-DD",
            format: onlyLevel("info"),
            maxSize: "20m",
            maxFiles: "7d",
        }),

        new DailyRotateFile({
            filename: "logs/warn-%DATE%.log",
            datePattern: "YYYY-MM-DD",
            format: onlyLevel("warn"),
            maxSize: "20m",
            maxFiles: "15d",
        }),

        new DailyRotateFile({
            filename: "logs/error-%DATE%.log",
            datePattern: "YYYY-MM-DD",
            format: onlyLevel("error"),
            maxSize: "20m",
            maxFiles: "60d",
        }),

        new winston.transports.Console()
    ]
});


module.exports = logger;