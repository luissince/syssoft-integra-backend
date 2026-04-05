module.exports = ({ conec, firebaseService }) => async function findAllDepreciacion(data) {
    const {
        opcion,
        buscar,
        idAlmacen,
        posicionPagina,
        filasPorPagina
    } = data;

    const bucket = firebaseService.getBucket();

    const result = await conec.procedure(`CALL Listar_Bien(?,?,?,?,?)`, [
        opcion,
        buscar,
        idAlmacen,
        parseInt(posicionPagina),
        parseInt(filasPorPagina)
    ]);

    const newResult = await Promise.all(result.map(async (item, index) => {
        const inventarioDetalles = await conec.procedure(`CALL Listar_Bien_Detalle(?,?)`, [
            item.idProducto,
            idAlmacen
        ]);

        return {
            ...item,
            id: (index + 1) + parseInt(posicionPagina),
            imagen: bucket && item.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : null,
            inventarioDetalles: inventarioDetalles
        };
    }));

    const total = await conec.procedure(`CALL Listar_Bien_Count(?,?,?)`, [
        opcion,
        buscar,
        idAlmacen
    ]);

    return { "result": newResult, "total": total[0].Total };
}