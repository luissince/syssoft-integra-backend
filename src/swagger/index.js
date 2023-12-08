const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const options = {
    failOnErrors: false,
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Node Mysql Api Inmobiliario',
            version: '1.0.0',
            description:
                'Esta API fue creada para la empresa GYMC INMOBILIARIA para sus procesos',

            license: {
                name: 'MIT',
                url: 'https://spdx.org/licenses/MIT.html',
            },
            contact: {
                name: 'Luis Lara',
                url: 'https://www.facebook.com/luisal.laras/',
            },
        },
        servers: [
            {
                url: "http://localhost:5000/",
                description: "EndPoint de desarrollo"
            },
            {
                url: "https://www.inmobiliariagmyc.com",
                description: "EndPoint de producción"
            },
        ]
    },
    apis: [path.join(__dirname, "..", "/router/*.js")]
}

module.exports = swaggerJsdoc(options);