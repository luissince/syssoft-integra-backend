const { default: axios } = require('axios');

class DniRucService {

    constructor() {
        this.dni = this.dni.bind(this);
        this.ruc = this.ruc.bind(this);

        this.api = axios.create({
            baseURL: process.env.CPE_SUNAT_URL,
            timeout: 30000,
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        });
    }

    async dni(req) {
        const { documento } = req.params;
        const response = await this.api.get(`/api/v1/dni/${documento}?token=${process.env.CPE_SUNAT_TOKEN}`);
        return response.data;
    }

    async ruc(req) {
        const { documento } = req.params;
        const response = await this.api.get(`/api/v1/ruc/${documento}?token=${process.env.CPE_SUNAT_TOKEN}`);
        return response.data;
    }
}

module.exports = new DniRucService();