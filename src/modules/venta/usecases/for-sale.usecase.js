
function aplicarDistribucionVenta(cantidadVenta, inventarioDetalles) {

    let restante = Number(cantidadVenta);

    // 1. Resetear todo
    for (const inv of inventarioDetalles) {
        inv.cantidadSeleccionada = 0;
    }

    // 2. Separar:
    const lotes = inventarioDetalles.filter(
        inv => inv.lote !== null && inv.cantidad > 0 && inv.diasRestantes > 0
    );

    // Registro default (SIN LOTE)
    const porDefecto = inventarioDetalles.find(
        inv => inv.lote === null
    );

    // 3. Ordenar lotes por vencimiento
    lotes.sort((a, b) => a.diasRestantes - b.diasRestantes);

    // 4. Distribuir en lotes primero
    for (const lote of lotes) {

        if (restante <= 0) break;

        const usar = Math.min(restante, lote.cantidad);

        lote.cantidadSeleccionada = usar;

        restante -= usar;
    }

    // 5. Si falta algo → mandarlo al default
    if (restante > 0 && porDefecto) {
        porDefecto.cantidadSeleccionada = restante;
        restante = 0;
    }

    return inventarioDetalles.filter(inv => inv.cantidadSeleccionada > 0);
}

module.exports = ({ conec, firebaseService }) => async function forSale(params) {
    const { idVenta, idAlmacen } = params;

    const bucket = firebaseService.getBucket();

    const cliente = await conec.query(`
    SELECT 
        p.idPersona,
        p.idTipoDocumento,
        p.documento,
        p.informacion,
        IFNULL(p.celular,'') AS celular,
        IFNULL(p.email,'') AS email,
        IFNULL(p.direccion,'') AS direccion
    FROM 
        venta AS v
    INNER JOIN 
        persona AS p ON p.idPersona = v.idCliente
    WHERE 
        v.idVenta = ?`, [
        idVenta
    ]);

    const detalles = await conec.query(`
    SELECT 
        vd.idProducto,
        vd.descripcion,
        vd.precio,
        vd.cantidad
    FROM
        ventaDetalle AS vd
    WHERE
        vd.idVenta = ?
    ORDER BY 
        vd.idVentaDetalle ASC`, [
        idVenta
    ]);

    let productos = [];
    let index = 0;

    for (const item of detalles) {
        const [producto] = await conec.procedure("CALL Filtrar_Productos_Para_Venta(?,?,?,?,?)", [
            3,
            item.idProducto,
            idAlmacen,
            0,
            1,
        ]);

        const inventarioDetalles = await conec.procedure("CALL Filtrar_Productos_Para_Venta_Inventario_Detalle(?,?)", [
            item.idProducto,
            idAlmacen,
        ]);

        const newProducto = {
            ...producto,
            nombreProducto: item.descripcion,
            precio: item.precio,
            imagen: bucket && producto.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${producto.imagen}` : null,
            inventarioDetalles: aplicarDistribucionVenta(item.cantidad, inventarioDetalles).map(inv => {
                const { cantidadSeleccionada, ...resto } = inv;

                return {
                    ...resto,
                    cantidad: cantidadSeleccionada
                }
            }),
            id: index + 1
        };

        productos.push(newProducto);
    }

    // Devuelve un objeto con la información de la venta, los detalles y las salidas
    return { cliente: cliente[0], productos };
}