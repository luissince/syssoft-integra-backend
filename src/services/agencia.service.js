const { CLIENT_INFO_REQUEST_NAMES } = require('../common/constants/names.constants');
const conec = require('../database/mysql-connection');

class Agencia {

    constructor() {
        this.combo = this.combo.bind(this);
    }

    async combo(req) {
        const list = await conec.query(`
        SELECT 
            idAgencia,
            nombre
        FROM 
            agencia 
        WHERE 
            estado = 1`);

        if (req.clientInfo.app === CLIENT_INFO_REQUEST_NAMES.CATALOG_NEXT) {
            return this._mapComboResponse(list);
        }

        return list;
    }

    _mapComboResponse(list) {
        return list.map(item => {
            return {
                idAgency: item.idAgencia,
                name: item.nombre
            }
        });
    }
}

module.exports = new Agencia();