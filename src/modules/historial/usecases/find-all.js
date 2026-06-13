module.exports = ({ conec }) => async function findAll(data) {
    const {
        opcion,
        buscar,
        almacen,
        fechaInicio,
        fechaFinal,
        posicionPagina,
        filasPorPagina
    } = data;
    const lista = await conec.procedure(`CALL Listar_Historial(?,?,?,?,?,?,?)`, [
        parseInt(opcion),
        buscar,
        almacen,
        fechaInicio,
        fechaFinal,
        parseInt(posicionPagina),
        parseInt(filasPorPagina)
    ]);

    const resultLista = await Promise.all(lista.map(async function (item, index) {
        return {
            ...item,
            id: (index + 1) + parseInt(posicionPagina),
        }
    }));

    const total = await conec.procedure(`CALL Listar_Historial_Count(?,?,?,?,?)`, [
        parseInt(opcion),
        buscar,
        almacen,
        fechaInicio,
        fechaFinal
    ]);

    return { "result": resultLista, "total": total[0] };
}

