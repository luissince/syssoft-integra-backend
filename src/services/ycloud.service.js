const axios = require("axios");
const conec = require("../database/mysql-connection");
const { ClientError } = require("../tools/Error");

class YCloudService {
    constructor() {
        this.sendText = this.sendText.bind(this);
        this.sendDocument = this.sendDocument.bind(this);

        this.api = axios.create({
            baseURL: process.env.YCLOUD_URL,
            timeout: 30000,
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        });
    }

    async getConfig() {
        const empresa = await conec.query(`
            SELECT 
                numeroWhatsapp, 
                ycloudApiKey
            FROM 
                empresa
            LIMIT 
                1
        `);

        if (!empresa.length) {
            throw new ClientError(
                "No se pudo obtener la configuración de la empresa."
            );
        }

        const { numeroWhatsapp, ycloudApiKey } = empresa[0];

        if (!ycloudApiKey || !numeroWhatsapp) {
            throw new ClientError(
                "Configura el número de WhatsApp y la API key de YCloud."
            );
        }

        return {
            from: numeroWhatsapp,
            apiKey: ycloudApiKey,
        };
    }

    async sendText(req) {
        const { to, message } = req.body;
        const config = await this.getConfig();

        const response = await this.api.post(
            "/whatsapp/messages",
            {
                from: config.from,
                to,
                type: "text",
                text: { body: message },
            },
            {
                headers: {
                    "X-API-Key": config.apiKey,
                },
            }
        );

        return response.data;
    }

    async sendDocument(req) {
        const { to, url, filename, caption } = req.body;
        const config = await this.getConfig();

        const response = await this.api.post(
            "/whatsapp/messages",
            {
                from: config.from,
                to,
                type: "document",
                document: {
                    link: url,
                    filename,
                    caption,
                },
            },
            {
                headers: {
                    "X-API-Key": config.apiKey,
                },
            }
        );

        return response.data;
    }
}

module.exports = new YCloudService();