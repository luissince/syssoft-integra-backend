const axios = require("axios");
const conec = require("../database/mysql-connection");
const { ClientError } = require("../tools/Error");

const WINDOW_MS = 24 * 60 * 60 * 1000;

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

    async validatePdfUrl(url) {
        try {
            const response = await axios.head(url, {
                timeout: 5000,
                maxRedirects: 5,
            });

            return (
                response.status === 200 &&
                response.headers["content-type"]?.includes("application/pdf")
            );
        } catch (error) {
            return false;
        }
    }

    async getConfig() {
        const rows = await conec.query(`
            SELECT
                razonSocial,
                nombreEmpresa,
                numeroWhatsapp, 
                ycloudApiKey
            FROM empresa
            LIMIT 1
        `);

        if (!rows.length) {
            throw new ClientError(
                "No se pudo obtener la configuración de la empresa."
            );
        }

        const { numeroWhatsapp, ycloudApiKey, razonSocial, nombreEmpresa } = rows[0];

        if (!numeroWhatsapp || !ycloudApiKey) {
            throw new ClientError(
                "Configura el número de WhatsApp y la API key de YCloud."
            );
        }

        return {
            legalName: nombreEmpresa || razonSocial,
            from: numeroWhatsapp,
            apiKey: ycloudApiKey,
        };
    }

    async postMessage(payload) {
        const config = await this.getConfig();

        const response = await this.api.post(
            "/whatsapp/messages",
            {
                from: config.from,
                ...payload,
            },
            {
                headers: {
                    "X-API-Key": config.apiKey,
                },
            }
        );

        return response.data;
    }

    async isWindowOpen(phone) {
        const rows = await conec.query(
            `SELECT ultimoMensaje
             FROM whatsappClienteSesion
             WHERE telefono = ?
             LIMIT 1`,
            [phone]
        );

        if (!rows.length || !rows[0].ultimoMensaje) {
            return false;
        }

        const lastMessage = new Date(
            rows[0].ultimoMensaje
        ).getTime();

        const elapsed = Date.now() - lastMessage;

        return elapsed >= 0 && elapsed < WINDOW_MS;
    }

    async sendTextTemplate(to, customerName) {
        const config = await this.getConfig();

        const response = await this.api.post(
            "/whatsapp/messages",
            {
                from: config.from,
                to,
                type: "template",
                template: {
                    name: "texto_comercial",
                    language: { code: "es" },
                    components: [
                        {
                            type: "header",
                            parameters: [
                                {
                                    type: "text",
                                    text: config.legalName,
                                },
                            ],
                        },
                        {
                            type: "body",
                            parameters: [
                                {
                                    type: "text",
                                    text: customerName || "cliente",
                                },
                            ],
                        },
                    ],
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

    async sendDocumentTemplate({
        to,
        url,
        filename,
        customerName,
        caption,
    }) {
        const config = await this.getConfig();

        const response = await this.api.post(
            "/whatsapp/messages",
            {
                from: config.from,
                to,
                type: "template",
                template: {
                    name: "documento_comercial",
                    language: { code: "es" },
                    components: [
                        {
                            type: "header",
                            parameters: [
                                {
                                    type: "document",
                                    document: {
                                        link: url,
                                        filename,
                                    },
                                },
                            ],
                        },
                        {
                            type: "body",
                            parameters: [
                                {
                                    type: "text",
                                    text: customerName || 'cliente',
                                },
                                {
                                    type: "text",
                                    text: caption || 'comprobante',
                                },
                            ],
                        },
                    ],
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

    async sendText(req) {
        const { to, message, name } = req.body;

        if (!to || !message) {
            throw new ClientError(
                "El destinatario y el mensaje son obligatorios."
            );
        }

        const isOpen = await this.isWindowOpen(to);

        if (!isOpen) {
            return this.sendTextTemplate(to, name);
        }

        return this.postMessage({
            to,
            type: "text",
            text: { body: message },
        });
    }

    async sendDocument(req) {
        const {
            to,
            url,
            filename,
            caption,
            name,
        } = req.body;

        if (!to || !url || !filename) {
            throw new ClientError(
                "El destinatario, URL y nombre del archivo son obligatorios."
            );
        }

        const isValidPdf = await validatePdfUrl(url);

        if (!isValidPdf) {
            throw new ClientError(
                "El documento no está disponible o no es un PDF válido."
            );
        }

        const isOpen = await this.isWindowOpen(to);

        if (!isOpen) {
            return this.sendDocumentTemplate({
                to,
                url,
                filename,
                name,
                caption,
            });
        }

        return this.postMessage({
            to,
            type: "document",
            document: {
                link: url,
                filename,
                ...(caption ? { caption } : {}),
            },
        });
    }

    async webhook(req) {
        const event = req.body;

        // Procesar únicamente mensajes entrantes
        if (event.type !== "whatsapp.inbound_message.received") {
            return "ok";
        }

        const message = event.whatsappInboundMessage;

        const phone = message?.from;
        const messageDate = message?.sendTime || event.createTime;

        if (!phone || !messageDate) {
            return "ok";
        }

        await conec.query(`
            INSERT INTO whatsappClienteSesion(
                telefono, 
                ultimoMensaje
            ) VALUES (?, ?)
            ON DUPLICATE KEY UPDATE
                ultimoMensaje = GREATEST(
                    ultimoMensaje,
                    VALUES(ultimoMensaje)
                )
            `,
            [phone, new Date(messageDate)]
        );

        return "ok";
    }
}

module.exports = new YCloudService();