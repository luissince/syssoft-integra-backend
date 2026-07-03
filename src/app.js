const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const routes = require('./routes');
const requestLogger = require('./middlewares/request-logger.middleware');

const app = express();

app.set('port', process.env.PORT || 5000);

app.use(morgan('dev'));

app.use(cors({
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

app.use(requestLogger);

routes(app);

module.exports = app;