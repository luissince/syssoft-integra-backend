
module.exports = ({ conec }) => async function filter(data) {
    const { tipo, idSucursal, filtrar } = data;

    return await conec.procedure(`CALL Filtrar_Ventas(?,?,?)`, [
        tipo,
        idSucursal,
        filtrar,
    ])
}

