const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");


const onlyLevel = (level) => {
    return winston.format((info) => {
        return info.level === level ? info : false;
    })();
};

const jsonOrTextFormat = winston.format.printf(({ level, message, timestamp, stack }) => {
    let output = message;

    if (!stack) {
        try {
            const jsonMessage = typeof message === "string"
                ? JSON.parse(message)
                : message;

            output = JSON.stringify(jsonMessage, null, 2);
        } catch {
            output = message;
        }
    } else {
        output = stack;
    }

    return `${new Date(timestamp).toLocaleString()} ${level}: ${output}`;
});


const logger = winston.createLogger({

    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true })
    ),

    transports: [

        new DailyRotateFile({
            filename: "logs/info-%DATE%.log",
            datePattern: "YYYY-MM-DD",
            format: winston.format.combine(
                onlyLevel("info"),
                jsonOrTextFormat
            ),
            maxSize: "20m",
            maxFiles: "7d",
        }),

        new DailyRotateFile({
            filename: "logs/warn-%DATE%.log",
            datePattern: "YYYY-MM-DD",
            format: winston.format.combine(
                onlyLevel("warn"),
                jsonOrTextFormat
            ),
            maxSize: "20m",
            maxFiles: "15d",
        }),

        new DailyRotateFile({
            filename: "logs/error-%DATE%.log",
            datePattern: "YYYY-MM-DD",
            format: winston.format.combine(
                onlyLevel("error"),
                jsonOrTextFormat
            ),
            maxSize: "20m",
            maxFiles: "60d",
        }),

        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize({ level: true }),
                jsonOrTextFormat
            )
        })
    ]
});


module.exports = logger;