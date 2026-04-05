
module.exports = ({ conec }) => async function findAll(data) {
    const { opcion, buscar, fechaInicio, fechaFinal, idComprobante, estado, idSucursal, posicionPagina, filasPorPagina } = data;
    
    const lista = await conec.procedure(`CALL Listar_CPE_Sunat(?,?,?,?,?,?,?,?,?)`, [
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

    const resultLista = lista.map(function (item, index) {
        return {
            ...item,
            id: (index + 1) + parseInt(posicionPagina)
        }
    });

    const total = await conec.procedure(`CALL Listar_CPE_Sunat_Count(?,?,?,?,?,?,?)`, [
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
