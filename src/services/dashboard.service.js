const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Dashboard {

    async init(fechaInicio, fechaFinal, idSucursal) {
        const result = await conec.procedureAll(`CALL Dashboard_Init(?,?,?)`, [
            fechaInicio,
            fechaFinal,
            idSucursal,
        ]);

        return {
            "totalSales": result[0][0].total ?? 0,
            "totalPurchases": result[1][0].total ?? 0,
            "creditSalesToCollect": result[2][0].total ?? 0,
            "creditPurchasesToPay": result[3][0].total ?? 0,
            "issuedDocuments": result[4][0].total ?? 0,
            "documentsToDeclare": result[5][0].total ?? 0,
            "createdQuotes": result[6][0].total ?? 0,
            "quotesLinkedToSales": result[7][0].total ?? 0,
            "branchPerformance": result[8] ?? [],
            "bankBalances": result[9] ?? [],
        };
    }

}

module.exports = new Dashboard();
