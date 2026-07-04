// worker.js

require('dotenv').config();

const initializeRabbit = require('./src/bootstrap/rabbit');

async function bootstrap() {
    await initializeRabbit();
}

bootstrap();