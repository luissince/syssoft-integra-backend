const { CLIENT_INFO_REQUEST_NAMES } = require('../common/constants/names.constants');
const conec = require('../database/mysql-connection');

class PlazoService {

    constructor() {
    }

    async combo() {
        const list = await conec.query(`
            SELECT 
                idPlazo, 
                nombre,
                dias
            FROM 
                plazo`);
        return list;
    }
}

module.exports = new PlazoService();