const Conexion = require('../database/Conexion');
const { currentDate, currentTime } = require('../tools/Tools');
const { sendSuccess, sendClient, sendSave, sendError } = require('../tools/Message');
const conec = new Conexion();

class NotaCredito {

    async list(req, res) {

    }

    async id(req, res) {

    }

    async idReport(req) {

    }

    async add(req, res) {

    }

    async delete(req, res) {

    }

    async xmlGenerate(req) {

    }

}

module.exports = new NotaCredito();