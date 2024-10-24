const { currentDate, currentTime, generateAlphanumericCode } = require('../tools/Tools');
const Conexion = require('../database/Conexion');
const { sendClient, sendSave, sendError, sendSuccess } = require('../tools/Message');
const conec = new Conexion();

class Transaccion {

    async dashboard(req, res) {
        try {
            const result = await conec.procedureAll(`CALL Dashboard_Financiero(?,?,?,?,?,?)`, [
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idSucursal,
                req.query.idUsuario,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            return sendSuccess(res, {
                "ingreso": result[0][0].total ?? 0,
                "salida": result[1][0].total ?? 0,
                "bancos": result[2] ?? [],
                "ingresos": result[3] ?? [],
                "salidas": result[4] ?? [],
                "lista": result[5] ?? [],
                "total": result[6][0].total ?? 0,
            });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Transaccion/dashboard", error);
        }
    }

    calculateTaxBruto(tax, amount) {
        return amount / ((tax + 100) * 0.01);
    }

    calculateTax(porcent, amount) {
        const tax = porcent / 100.0;
        return amount * tax;
    }


}

module.exports = Transaccion;