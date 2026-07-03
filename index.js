require('dotenv').config();

const app = require('./src/app');
const startHttpServer = require('./src/bootstrap/http');
const initializeRabbit = require('./src/bootstrap/rabbit');

async function bootstrap() {
    startHttpServer(app);
    initializeRabbit();
}

bootstrap();