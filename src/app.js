const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const cookieParser = require('cookie-parser');

const routes = require('./routes');
const requestLogger = require('./middlewares/request-logger.middleware');
const { CLIENT_INFO_REQUEST_HEADER, CLIENT_INFO_REQUEST_VERSION } = require('./common/constants/names.constants');

const app = express();

app.set('port', process.env.PORT || 5000);

app.use(morgan('dev'));

const allowedOrigins = [
    "http://localhost:3666",
    "http://localhost:3000",

    "https://www.leatsac.com",
    "https://app.leatsac.com",

    "https://www.syssoftintegra.com",
    "https://app.syssoftintegra.com",
    "https://api.syssoftintegra.com",
    "https://shop.syssoftintegra.com",

    "https://www.importmuneli.com",
    "https://app.importmuneli.com"
];

app.use(cookieParser());

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    exposedHeaders: ['Content-Disposition']
}));

app.use(
    '/public',
    express.static(
        path.join(process.cwd(), 'public')
    )
);

app.use(express.json({
    limit: '100mb'
}));

app.use(express.urlencoded({
    extended: false
}));

app.use((req, res, next) => {
    req.clientInfo = {
        app: req.get(CLIENT_INFO_REQUEST_HEADER) || 'unknown',
        version: req.get(CLIENT_INFO_REQUEST_VERSION) || 'unknown',
    };

    next();
});

app.use(requestLogger);

routes(app);

module.exports = app;