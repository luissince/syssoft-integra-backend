
module.exports = ({ conec }) => async function findAll(data) {
    const { buscar, posicionPagina, filasPorPagina } = data;

    const lista = await conec.procedure("CALL Listar_Usuarios(?,?,?)", [
        buscar,

        parseInt(posicionPagina),
        parseInt(filasPorPagina)
    ])

    const resultLista = lista.map(function (item, index) {
        return {
            ...item,
            id: (index + 1) + parseInt(posicionPagina)
        }
    });

    const total = await conec.procedure("CALL Listar_Usuarios_Count(?)", [
        buscar,
    ]);

    return { "result": resultLista, "total": total[0].Total };
}
