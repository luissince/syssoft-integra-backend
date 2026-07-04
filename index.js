// server.js

require('dotenv').config();

const app = require('./src/app');
const startHttpServer = require('./src/bootstrap/http');

async function bootstrap() {
    startHttpServer(app);
}

bootstrap();