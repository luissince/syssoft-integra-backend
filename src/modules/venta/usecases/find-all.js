module.exports = ({ conec }) => async function findAll(data) {
    const {
        opcion,
        buscar,
        fechaInicio,
        fechaFinal,
        idComprobante,
        estado,
        idSucursal,
        posicionPagina,
        filasPorPagina
    } = data;
    const lista = await conec.procedure(`CALL Listar_Ventas(?,?,?,?,?,?,?,?,?)`, [
        parseInt(opcion),
        buscar,
        fechaInicio,
        fechaFinal,
        idComprobante,
        parseInt(estado),
        idSucursal,

        parseInt(posicionPagina),
        parseInt(filasPorPagina)
    ])

    const resultLista = await Promise.all(lista.map(async function (item, index) {
        const guiaRemision = await conec.query(`
        SELECT 
            COUNT(*) AS total
        FROM 
            guiaRemision as gui 
        WHERE 
            gui.idVenta = ?`, [
            item.idVenta
        ]);

        return {
            ...item,
            guiaRemision: guiaRemision.length > 0 ? guiaRemision[0].total : 0,
            id: (index + 1) + parseInt(posicionPagina),
        }
    }));

    const total = await conec.procedure(`CALL Listar_Ventas_Count(?,?,?,?,?,?,?)`, [
        parseInt(opcion),
        buscar,
        fechaInicio,
        fechaFinal,
        idComprobante,
        parseInt(estado),
        idSucursal
    ]);

    return { "result": resultLista, "total": total[0].Total };
}

