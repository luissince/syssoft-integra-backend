module.exports = ({ conec }) => async function findAll(data) {
    const {
        opcion,
        buscar,
        posicionPagina,
        filasPorPagina
    } = data;

    const list = await conec.procedure(`CALL Listar_Atributos(?,?,?,?)`, [
        parseInt(opcion),
        buscar,

        parseInt(posicionPagina),
        parseInt(filasPorPagina)
    ]);

    const resultList = list.map(function (item, index) {
        return {
            id: index + 1 + parseInt(posicionPagina),
            idAtributo: item.idAtributo,
            nombre: item.nombre,
            hexadecimal: item.hexadecimal,
            valor: item.valor,
            estado: item.estado,
            fecha: item.fecha,
            hora: item.hora,
            tipoAtributo: {
                idTipoAtributo: item.idTipoAtributo,
                nombre: item.nombreTipoAtributo
            }
        };
    });

    const total = await conec.procedure(`CALL Listar_Atributos_Count(?,?)`, [
        parseInt(opcion),
        buscar
    ]);

    return { "result": resultList, "total": total[0].Total };
}