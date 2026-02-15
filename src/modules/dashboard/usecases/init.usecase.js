module.exports = ({ conec }) => async function init(data) {
    const { fechaInicio, fechaFinal, idSucursal } = data;

    const result = await conec.procedureAll(`CALL Dashboard_Init(?,?,?)`, [
        fechaInicio,
        fechaFinal,
        idSucursal,
    ]);

    console.log(result);

    return {
        "metaDiaria": result[0][0],
        "capital": result[1][0],
        "cajaDeFlujo": result[2],
        "totalVentas": result[3][0].total ?? 0,
        "totalCompras": result[4][0].total ?? 0,
        "ventasPorRecibir": result[5][0].total ?? 0,
        "comprasPorPagar": result[6][0].total ?? 0,
        "documentosEmision": result[7][0].total ?? 0,
        "documentosPorDeclarar": result[8][0].total ?? 0,
        "cotizacionesCreadas": result[9][0].total ?? 0,
        "cotizacionesEnlaceVentas": result[10][0].total ?? 0,
        "rendimientoSucursal": result[11] ?? [],
        "balanceBancario": result[12] ?? [],
        "ventasAnuales": result[13] ?? [],
    };
};