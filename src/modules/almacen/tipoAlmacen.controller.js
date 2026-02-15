const TipoAlmacenService = require('./tipoAlmacen.service');
const tipoAlmacenService = new TipoAlmacenService();

const combo = async (req, res) => {
    const result = await tipoAlmacenService.combo(req);
    if (Array.isArray(result)) {
        res.status(200).send(result);
    } else {
        res.status(400).send(result);
    }
};

module.exports = {
    combo
};
