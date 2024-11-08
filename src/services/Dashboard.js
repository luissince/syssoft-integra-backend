const { sendSuccess, sendError } = require('../tools/Message');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Dashboard {

    async init(req, res) {
        try {
            const result = await conec.procedureAll(`CALL Dashboard_Init(?)`, [
                req.query.idSucursal,
            ]);

            return sendSuccess(res, {
                "totalVentas": result[0][0].total ?? 0,
                "totalCompras": result[1][0].total ?? 0,
                "totalCuentasPorCobrar": result[2][0].total ?? 0,
                "totalCuentasPorPagar": result[3][0].total ?? 0,
                "totalComprobantes": result[4][0].total ?? 0,
                "totalComprobantesPorDeclarar": result[5][0].total ?? 0,
                "totalCotizaciones": result[6][0].total ?? 0,
                "totalCotizacionesLigadas": result[7][0].total ?? 0,
                "sucursales": result[8] ?? [],
                // "totalInventario": result[5][0].total ?? 0,
                // "totalSucursales": result[6][0].total ?? 0,
                // "inventarios": result[7] ?? [],
            });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Dashboard/init", error);
        }
    }

}

module.exports = new Dashboard();