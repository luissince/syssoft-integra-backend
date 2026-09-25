const { default: axios } = require('axios');

class DniRucService {

    async dni(req) {
        const { documento } = req.params;

        try {
            const options = {
                method: 'GET',
                url: `${process.env.CPE_SUNAT_URL}/api/v1/dni/${documento}?token=${process.env.CPE_SUNAT_TOKEN}`,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
            };

            const response = await axios.request(options);
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    async ruc(req) {
        const { documento } = req.params;
        try {
            const options = {
                method: 'GET',
                url: `${process.env.CPE_SUNAT_URL}/api/v1/ruc/${documento}?token=${process.env.CPE_SUNAT_TOKEN}`,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
            };

            const response = await axios.request(options);
            return response.data;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new DniRucService();