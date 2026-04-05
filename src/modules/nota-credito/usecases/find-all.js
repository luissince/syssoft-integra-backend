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
    const lista = await conec.procedure(`CALL Listar_Nota_Creditos(?,?,?,?,?,?,?,?,?)`, [
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
        return {
            ...item,
            id: (index + 1) + parseInt(posicionPagina),
        }
    }));

    const total = await conec.procedure(`CALL Listar_Nota_Creditos_Count(?,?,?,?,?,?,?)`, [
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

