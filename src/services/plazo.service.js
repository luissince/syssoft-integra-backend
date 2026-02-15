const conec = require('../database/mysql-connection');

class PlazoService {

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