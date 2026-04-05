
module.exports = ({ conec }) => async function findAll(data) {
    const { idAlmacen, idProducto } = data;

    const kardex = await conec.procedure(`CALL Listar_Kardex(?,?)`, [
        idAlmacen,
        idProducto,
    ]);

    const resultLista = kardex.map((item, index) => ({
        ...item,
        id: index + 1,
    }));

    return resultLista;
}
