
const plazo = require("../services/plazo.service");
const { sendSuccess, sendError } = require("../tools/Message");

async function combo(req, res) {
    try {
        const data = await plazo.combo();
        return sendSuccess(res, data);
    } catch (error) {
        return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Plazo/combo", error);
    }
}

module.exports = {
    combo,
};
