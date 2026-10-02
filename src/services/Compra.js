const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode, formatDecimal, formatNumberWithZeros, calculateTaxBruto, calculateTax, renderTemplate, } = require('../tools/Tools');
const { sendSave, sendError, sendSuccess, sendClient, sendFile } = require('../tools/Message');
const axios = require('axios').default;
const conec = require('../database/mysql-connection');
const firebaseService = require('../common/fire-base');
const { TIPO_KARDEX, MOTIVO_KARDEX } = require('../common/constants/kardex.constants');
const { TIPO_PRODUCTO_NORMAL, TIPO_PRODUCTO_SERVICIO } = require('../common/constants/tipo-producto.constants');
const { ClientError } = require('../tools/Error');
const { cssUrl, logoUrl } = require('../common/constants/paths.constants');
const NumberLleters = require('../tools/NumberLleters');

class Compra {

    async list(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Compras(?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_Compras_Count(?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,
            ]);

            // return { "result": resultLista, "total": total[0].Total };
            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Compra/list", error);
        }
    }

    async create(req, res) {
        let connection = null;
        try {
            // Inicia la transacción
            connection = await conec.beginTransaction();

            // Obtener la fecha y hora actual
            const date = currentDate();
            const time = currentTime();

            // Extrae los datos del cuerpo de la solicitud
            const {
                idComprobante,
                idProveedor,
                idUsuario,
                idSucursal,
                idAlmacen,
                idMoneda,
                idOrdenCompra,
                observacion,
                nota,
                estado,
                detalles,

                idFormaPago,
                bancosAgregados,
                idPlazo,
                notaTransacion
            } = req.body;

            if (idOrdenCompra) {
                const comprados = await conec.query(`
                SELECT 
                    p.idProducto,
                    SUM(vd.cantidad) AS cantidad
                FROM 
                    compraOrdenCompra AS vc
                INNER JOIN
                    compra AS v ON v.idCompra = vc.idCompra AND v.estado <> 3
                INNER JOIN
                    compraDetalle AS vd ON vd.idCompra = v.idCompra
                INNER JOIN
                    producto AS p ON p.idProducto = vd.idProducto
                WHERE 
                    vc.idOrdenCompra = ?
                GROUP BY 
                    p.idProducto`, [
                    idOrdenCompra
                ]);

                const ordenCompraDetalles = await conec.query(`
                SELECT 
                    cd.idProducto,
                    cd.costo,
                    cd.cantidad
                FROM
                    ordenCompraDetalle AS cd
                WHERE
                    cd.idOrdenCompra = ?`, [
                    idOrdenCompra
                ]);

                const newDetallesOrdenCompra = ordenCompraDetalles.map((detalle) => {
                    const item = comprados.find(pro => pro.idProducto === detalle.idProducto);
                    if (item) {
                        if (item.cantidad !== detalle.cantidad) {
                            return {
                                ...detalle,
                                cantidad: Math.abs(item.cantidad - detalle.cantidad),
                            };
                        }
                    } else {
                        return { ...detalle };
                    }
                    return null; // Se retorna `null` para que después se filtre
                }).filter(Boolean);

                const newDetallesCompra = [];
                for (const item of detalles) {
                    if (item.idTipoProducto === TIPO_PRODUCTO_NORMAL) {
                        const producto = await conec.execute(connection, `
                        SELECT 
                            p.costo, 
                            pc.valor AS precio 
                        FROM 
                            producto AS p 
                        INNER JOIN 
                            precio AS pc ON p.idProducto = pc.idProducto AND pc.preferido = 1
                        WHERE 
                            p.idProducto = ?`, [
                            item.idProducto,
                        ]);

                        const cantidad = item.inventarios.reduce((sum, inventario) => {
                            let cantidad = 0;

                            if (["TT0001", "TT0004", "TT0003"].includes(item.idTipoTratamientoProducto)) {
                                cantidad = inventario.cantidad;
                            } else if (item.idTipoTratamientoProducto === "TT0002") {
                                cantidad = item.precio / producto[0].precio;
                            }

                            return sum + cantidad;
                        }, 0);

                        newDetallesVenta.push({
                            idProducto: item.idProducto,
                            cantidad
                        });
                    }

                    if (item.idTipoProducto === TIPO_PRODUCTO_SERVICIO) {
                        newDetallesCompra.push({
                            idProducto: item.idProducto,
                            cantidad: item.cantidad
                        });
                    }
                }

                // 1️ Validación de cantidad de ítems
                if (newDetallesCompra.length > newDetallesOrdenCompra.length) {
                    throw new Error("El número de productos en la orden de compra no coincide con los productos comprados.");
                }

                // 2 Validación de ids
                const ids1 = new Set(newDetallesOrdenCompra.map(obj => obj.idProducto));
                const ids2 = new Set(newDetallesCompra.map(obj => obj.idProducto));

                for (let id of ids2) {
                    if (!ids1.has(id)) {
                        throw new Error("Los productos comprados no son iguales al de la orden de compra.");
                    }
                }

                // 3 Validación de cantidad de productos
                const map1 = new Map(newDetallesOrdenCompra.map(obj => [obj.idProducto, obj.cantidad]));
                const map2 = new Map(newDetallesCompra.map(obj => [obj.idProducto, obj.cantidad]));

                const diferencias = [];
                for (let [idProducto, cantidad] of map1) {
                    if (map2.has(idProducto)) {
                        if (map2.get(idProducto) > cantidad) {
                            diferencias.push(true);
                        }
                    }
                }

                if (diferencias.length > 0) {
                    throw new Error("Algunos productos tienen una cantidad diferente a la orden de compra.");
                }
            }

            // Genera un nuevo ID para la compra
            const listCompras = await conec.execute(connection, `SELECT idCompra FROM compra`);
            const idCompra = generateAlphanumericCode("CP0001", listCompras, 'idCompra');

            // Consulta datos del comprobante para generar la numeración
            const comprobante = await conec.execute(connection, `
            SELECT 
                serie,
                numeracion 
            FROM 
                comprobante 
            WHERE 
                idComprobante  = ?`, [
                idComprobante
            ]);

            // Consulta numeraciones de compras asociadas al mismo comprobante
            const compras = await conec.execute(connection, `
            SELECT 
                numeracion  
            FROM 
                compra 
            WHERE 
                idComprobante = ?`, [
                idComprobante
            ]);

            // Genera una nueva numeración para la compra
            const numeracion = generateNumericCode(comprobante[0].numeracion, compras, "numeracion");

            // Obtener fecha de vencimiento sin el plazo no es null
            let fechaVencimiento = null;

            if (idPlazo) {
                const plazo = await conec.execute(connection, `
                SELECT 
                    dias 
                FROM 
                    plazo 
                WHERE 
                    idPlazo = ?`, [
                    idPlazo
                ]);

                if (plazo.length > 0) {
                    const current = new Date();
                    current.setDate(current.getDate() + parseInt(plazo[0].dias, 10));
                    fechaVencimiento = current;
                }
            }

            // Inserta la información principal de la compra en la base de datos
            await conec.execute(connection, `
            INSERT INTO compra(
                idCompra,
                idProveedor,
                idUsuario,
                idComprobante,
                idSucursal,
                idMoneda,
                idAlmacen,
                serie,
                numeracion,
                idFormaPago,
                idPlazo,
                fechaVencimiento,
                observacion,
                nota,
                estado,
                fecha,
                hora
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idCompra,
                idProveedor,
                idUsuario,
                idComprobante,
                idSucursal,
                idMoneda,
                idAlmacen,
                comprobante[0].serie,
                numeracion,
                idFormaPago,
                idPlazo,
                fechaVencimiento,
                observacion,
                nota,
                estado,
                date,
                time,
            ]);

            // Genera un nuevo ID para los detalles de compra
            const listaCompraDetalle = await conec.execute(connection, `SELECT idCompraDetalle FROM compraDetalle`);
            let idCompraDetalle = generateNumericCode(1, listaCompraDetalle, 'idCompraDetalle');

            // Consulta el último ID de Kardex            
            const kardexIds = await conec.execute(connection, 'SELECT idKardex FROM kardex');
            let idKardex = kardexIds.length ? Math.max(...kardexIds.map(item => parseInt(item.idKardex.replace("KD", '')))) : 0;

            const generarIdKardex = () => `KD${String(++idKardex).padStart(4, '0')}`;

            // Inserta los detalles de compra en la base de datos
            for (const item of detalles) {
                const cantidad = Number(item.cantidad);

                // Calcular es costo actual en base a la formula de costo promedio ponderado
                const valorTotalInventarioInicial = await conec.execute(connection, `
                SELECT 
                    i.cantidad,
                    IFNULL(SUM(i.cantidad * p.costo), 0) AS total
                FROM 
                    inventario as i
                JOIN
                    producto as p ON i.idProducto = p.idProducto
                WHERE 
                    i.idProducto = ? and i.idAlmacen = ?`, [
                    item.idProducto,
                    idAlmacen
                ]);

                let costo = 0;

                if (valorTotalInventarioInicial.length !== 0 && valorTotalInventarioInicial[0].total !== 0) {
                    const valorTotalNuevaCompra = item.costo * cantidad;
                    const sumaTotales = valorTotalInventarioInicial[0].total + valorTotalNuevaCompra;
                    const sumaCantidades = cantidad + valorTotalInventarioInicial[0].cantidad;
                    const costoPromedio = sumaTotales / sumaCantidades;
                    costo = costoPromedio;
                } else {
                    costo = item.costo;
                }

                // Obtener inventario
                const inventario = await conec.execute(connection, `
                SELECT 
                    idInventario 
                FROM 
                    inventario 
                WHERE 
                    idProducto = ? AND idAlmacen = ?`, [
                    item.idProducto,
                    idAlmacen,
                ]);

                // Inserta información en el Kardex
                await conec.execute(connection, `
                INSERT INTO kardex(
                    idKardex,
                    idProducto,
                    idTipoKardex,
                    idMotivoKardex,
                    idCompra,
                    detalle,
                    cantidad,
                    costo,
                    idAlmacen,
                    idInventario,
                    fecha,
                    hora,
                    idUsuario
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                    generarIdKardex(),
                    item.idProducto,
                    TIPO_KARDEX.INGRESO,
                    MOTIVO_KARDEX.AJUSTE,
                    idCompra,
                    'INGRESO POR COMPRA',
                    cantidad,
                    costo,
                    idAlmacen,
                    inventario[0].idInventario,
                    date,
                    time,
                    idUsuario
                ]);

                if (inventario.length === 0) {
                    throw new Error(
                        `No existe inventario | Producto: ${item.idProducto} | Almacen: ${idAlmacen}`
                    );
                }

                // Actualiza el inventario
                await conec.execute(connection, `
                UPDATE 
                    inventario 
                SET 
                    cantidad = cantidad + ?
                WHERE 
                    idInventario = ?`, [
                    cantidad,
                    inventario[0].idInventario
                ]);

                // Actualizar el costo del producto
                if (costo > 0 && Number.isFinite(costo)) {
                    await conec.execute(connection, `
                    UPDATE 
                        producto 
                    SET 
                        costo = ?
                    WHERE 
                        idProducto = ?`, [
                        costo,
                        item.idProducto
                    ]);

                }

                // Insertar en la compra detalle
                await await conec.execute(connection, `
                INSERT INTO compraDetalle(
                    idCompraDetalle,
                    idCompra,
                    idProducto,
                    costo,
                    cantidad,
                    idImpuesto
                ) VALUES(?,?,?,?,?,?)`, [
                    idCompraDetalle,
                    idCompra,
                    item.idProducto,
                    item.costo,
                    cantidad,
                    item.idImpuesto
                ]);

                idCompraDetalle++;
            }

            // Si el tipo de compra es contado
            if (idFormaPago === 'FP0001') {
                const listaTransaccion = await conec.execute(connection, 'SELECT idTransaccion FROM transaccion');
                let idTransaccion = generateAlphanumericCode('TC0001', listaTransaccion, 'idTransaccion');

                await conec.execute(connection, `
                INSERT INTO transaccion(
                    idTransaccion,
                    idConcepto,
                    idReferencia,
                    idSucursal,
                    nota,
                    fecha,
                    hora,
                    idUsuario
                ) VALUES(?,?,?,?,?,?,?,?)`, [
                    idTransaccion,
                    'CP0002',
                    idCompra,
                    idSucursal,
                    notaTransacion,
                    date,
                    time,
                    idUsuario
                ]);

                const listaTransaccionDetalle = await conec.execute(connection, 'SELECT idTransaccionDetalle FROM transaccionDetalle');
                let idTransaccionDetalle = generateNumericCode(1, listaTransaccionDetalle, 'idTransaccionDetalle');

                // Proceso de registro  
                for (const item of bancosAgregados) {
                    await conec.execute(connection, `
                    INSERT INTO transaccionDetalle(
                        idTransaccionDetalle,
                        idTransaccion,
                        idBanco,
                        monto,
                        observacion
                    ) VALUES(?,?,?,?,?)`, [
                        idTransaccionDetalle,
                        idTransaccion,
                        item.idBanco,
                        item.monto,
                        item.observacion
                    ]);

                    idTransaccionDetalle++;
                }
            }

            // Si la compra está asociada a una orden de compra
            if (idOrdenCompra) {
                const listaIdCompraOrdenCompra = await conec.execute(connection, 'SELECT idCompraOrdenCompra FROM compraOrdenCompra');
                const idCompraOrdenCompra = generateNumericCode(1, listaIdCompraOrdenCompra, 'idCompraOrdenCompra');

                await conec.execute(connection, `
                INSERT INTO compraOrdenCompra(
                    idCompraOrdenCompra, 
                    idCompra, 
                    idOrdenCompra, 
                    fecha, 
                    hora,
                    idUsuario
                ) VALUES (?,?,?,?,?,?)`, [
                    idCompraOrdenCompra,
                    idCompra,
                    idOrdenCompra,
                    date,
                    time,
                    idUsuario
                ]);
            }

            // Confirma la transacción
            await conec.commit(connection);
            return sendSave(res, {
                idCompra: idCompra,
                message: "Se registró correctamente la compra."
            });
        } catch (error) {
            // En caso de error, realiza un rollback y devuelve un mensaje de error
            if (connection != null) {
                await conec.rollback(connection);
            }

            if (error instanceof ClientError) {
                return sendClient(res, error.message, "Compra/create", error);
            }

            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Compra/create", error);
        }
    }

    async detail(req, res) {
        try {
            // Consulta la información principal de la compra
            const compra = await conec.query(`
            SELECT 
                DATE_FORMAT(c.fecha, '%d/%m/%Y') AS fecha, 
                c.hora,
                
                co.nombre AS comprobante,
                c.serie,
                c.numeracion,

                cn.documento,
                cn.informacion,
                cn.telefono,
                cn.celular,
                cn.email,
                cn.direccion,                

                fc.idFormaPago,
                fc.nombre AS formaPago,

                c.estado,
                c.observacion,
                c.nota,

                al.nombre AS almacen,

                mo.codiso,
                
                CONCAT(us.nombres,' ',us.apellidos) AS usuario
            FROM 
                compra AS c
            INNER JOIN 
                comprobante AS co ON co.idComprobante = c.idComprobante
            INNER JOIN 
                formaPago AS fc ON fc.idFormaPago = c.idFormaPago
            INNER JOIN 
                moneda AS mo ON mo.idMoneda = c.idMoneda
            INNER JOIN 
                almacen AS al ON al.idAlmacen = c.idAlmacen
            INNER JOIN 
                persona AS cn ON cn.idPersona = c.idProveedor
            INNER JOIN 
                usuario AS us ON us.idUsuario = c.idUsuario 
            WHERE 
                c.idCompra = ?`, [
                req.query.idCompra,
            ]);

            // Consulta los detalles de la compra
            const detalles = await conec.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY cd.idCompraDetalle ASC) AS id,
                p.idProducto,
                c.idAlmacen,
                p.imagen,
                p.nombre AS producto,
                md.nombre AS medida, 
                m.nombre AS categoria, 
                cd.costo,
                cd.cantidad,
                cd.idImpuesto,
                imp.nombre AS impuesto,
                imp.porcentaje
            FROM 
                compraDetalle AS cd 
            INNER JOIN 
                producto AS p ON cd.idProducto = p.idProducto 
            INNER JOIN 
                compra AS c ON c.idCompra = cd.idCompra
            INNER JOIN 
                medida AS md ON md.idMedida = p.idMedida 
            INNER JOIN 
                categoria AS m ON p.idCategoria = m.idCategoria 
            INNER JOIN 
                impuesto AS imp ON cd.idImpuesto = imp.idImpuesto  
            WHERE 
                cd.idCompra = ?
            ORDER BY 
                cd.idCompraDetalle ASC`, [
                req.query.idCompra,
            ]);

            const listaDetalles = detalles.map(item => {
                return {
                    ...item,
                    imagen: firebaseService.getUrl(item.imagen),
                }
            });

            // Obtener información de transacciones asociados a la compra
            const transacciones = await conec.query(`
            SELECT 
                t.idTransaccion,
                DATE_FORMAT(t.fecha,'%d/%m/%Y') AS fecha,
                t.hora,
                c.nombre AS concepto,
                t.nota,
                CONCAT(us.nombres,' ',us.apellidos) AS usuario
            FROM 
                transaccion t            
            INNER JOIN
                concepto c ON c.idConcepto = t.idConcepto
            INNER JOIN 
                usuario AS us ON us.idUsuario = t.idUsuario 
            WHERE 
                t.idReferencia = ?`, [
                req.query.idCompra
            ]);

            for (const transaccion of transacciones) {
                const detalles = await conec.query(`
                    SELECT 
                        b.nombre,
                        td.monto,
                        td.observacion
                    FROM
                        transaccionDetalle td
                    INNER JOIN 
                        banco b on td.idBanco = b.idBanco     
                    WHERE 
                        td.idTransaccion = ?`, [
                    transaccion.idTransaccion
                ]);

                transaccion.detalles = detalles;
            }

            // Devuelve un objeto con la información de la compra, los detalles y las salidas
            return sendSave(res, { cabecera: compra[0], detalles: listaDetalles, transacciones });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Compra/detail", error);
        }
    }

    async cancel(req, res) {
        let connection = null;
        try {
            // Inicia una transacción
            connection = await conec.beginTransaction();

            // Obtener fecha y hora actuales
            const date = currentDate();
            const time = currentTime();

            // Consulta la información de la compra que se va a cancelar
            const validate = await conec.execute(connection, `
            SELECT 
                idAlmacen,
                estado 
            FROM 
                compra 
            WHERE 
                idCompra = ?`, [
                req.query.idCompra
            ]);

            // Verifica si la compra existe
            if (validate.length === 0) {
                // Si no existe, realiza un rollback y devuelve un mensaje de error
                throw new ClientError("La compra no existe, verifique el código o actualiza la lista.");
            }

            // Verifica si la compra ya está anulada
            if (validate[0].estado === 3) {
                // Si ya está anulada, realiza un rollback y devuelve un mensaje de error
                throw new ClientError("La compra ya se encuentra anulada.");
            }

            // Actualiza el estado de la compra a anulado
            await conec.execute(connection, `
            UPDATE 
                compra 
            SET 
                estado = 3 
            WHERE 
                idCompra = ?`, [
                req.query.idCompra
            ]);

            // Actualiza el estado de la transacción asociada a la compra
            await conec.execute(connection, `
            UPDATE 
                transaccion 
            SET 
                estado = 0 
            WHERE 
                idReferencia = ?`, [
                req.query.idCompra
            ]);


            // Obtiene los detalles de la compra
            const detalleCompra = await conec.execute(connection, `
            SELECT 
                idProducto,
                costo,
                cantidad 
            FROM 
                compraDetalle 
            WHERE 
                idCompra = ?`, [
                req.query.idCompra
            ]);

            // Obtener ID kardex siguiente
            const resultKardex = await conec.execute(connection, `SELECT idKardex FROM kardex`);
            let idKardex = resultKardex.length > 0
                ? Math.max(...resultKardex.map(k => parseInt(k.idKardex.replace("KD", ''))))
                : 0;

            const generarIdKardex = () => `KD${String(++idKardex).padStart(4, '0')}`;

            // Procesar cada detalle de la compra
            for (const detalle of detalleCompra) {
                // Obtener el kardex del compra por idProducto
                const kardexes = await conec.execute(connection, `
                SELECT 
                    k.idProducto,
                    k.cantidad,
                    k.costo,
                    k.idAlmacen,
                    k.idInventario
                FROM 
                    kardex AS k 
                WHERE 
                    k.idCompra = ? AND k.idProducto = ?`, [
                    req.query.idCompra,
                    detalle.idProducto,
                ]);

                for (const kardex of kardexes) {
                    // Inserta un nuevo registro en el kardex
                    await conec.execute(connection, `
                    INSERT INTO kardex(
                        idKardex,
                        idProducto,
                        idTipoKardex,
                        idMotivoKardex,
                        idCompra,
                        detalle,
                        cantidad,
                        costo,
                        idAlmacen,
                        idInventario,
                        fecha,
                        hora,
                        idUsuario
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                        generarIdKardex(),
                        kardex.idProducto,
                        TIPO_KARDEX.SALIDA,
                        MOTIVO_KARDEX.DEVOLUCION,
                        req.query.idCompra,
                        'ANULACIÓN DE LA COMPRA',
                        kardex.cantidad,
                        kardex.costo,
                        kardex.idAlmacen,
                        kardex.idInventario,
                        date,
                        time,
                        req.query.idUsuario
                    ]);

                    // Actualiza la cantidad en el inventario
                    await conec.execute(connection, `
                    UPDATE 
                        inventario 
                    SET 
                        cantidad = cantidad - ?
                    WHERE 
                        idInventario = ?`, [
                        kardex.cantidad,
                        kardex.idInventario
                    ]);
                }
            }

            // Realiza un rollback para confirmar la operación y devuelve un mensaje de éxito
            await conec.commit(connection);
            return sendSave(res, "Se anuló correctamente la compra.");
        } catch (error) {
            // Manejo de errores: Si hay un error, realiza un rollback y devuelve un mensaje de error
            if (connection != null) {
                await conec.rollback(connection);
            }

            if (error instanceof ClientError) {
                return sendClient(res, error.message, "Compra/cancel", error);
            }

            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Compra/cancel", error);
        }
    }

    async createAccountsPayable(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const {
                idCompra,
                idSucursal,
                idUsuario,
                monto,
                notaTransacion,
                bancosAgregados,
            } = req.body;

            const fecha = currentDate();
            const hora = currentTime();

            const resumen = await conec.execute(connection, `
            SELECT 
                SUM(cd.cantidad * cd.costo) AS total,
                (
                    SELECT 
                        IFNULL(SUM(td.monto), 0)
                    FROM 
                        transaccion AS t
                    INNER JOIN 
                        transaccionDetalle AS td ON t.idTransaccion = td.idTransaccion
                    WHERE 
                        t.idReferencia = c.idCompra AND t.estado = 1
                ) AS pagado
            FROM 
                compra AS c 
            INNER JOIN 
                compraDetalle AS cd ON cd.idCompra = c.idCompra
            WHERE 
                c.idCompra = ?`, [
                idCompra
            ]);

            if (monto + resumen[0].pagado >= resumen[0].total) {
                await conec.execute(connection, `
                UPDATE 
                    compra
                SET 
                    estado = 1
                WHERE 
                    idCompra = ?`, [
                    idCompra
                ]);
            }

            // Proceso de registro  
            const listaTransaccion = await conec.execute(connection, 'SELECT idTransaccion FROM transaccion');
            let idTransaccion = generateAlphanumericCode('TC0001', listaTransaccion, 'idTransaccion');

            await conec.execute(connection, `
            INSERT INTO transaccion(
                idTransaccion,
                idConcepto,
                idReferencia,
                idSucursal,
                nota,               
                fecha,
                hora,
                idUsuario
            ) VALUES(?,?,?,?,?,?,?,?)`, [
                idTransaccion,
                'CP0004',
                idCompra,
                idSucursal,
                notaTransacion,                
                fecha,
                hora,
                idUsuario
            ]);

            const listaTransaccionDetalle = await conec.execute(connection, 'SELECT idTransaccionDetalle FROM transaccionDetalle');
            let idTransaccionDetalle = generateNumericCode(1, listaTransaccionDetalle, 'idTransaccionDetalle');

            for (const item of bancosAgregados) {
                await conec.execute(connection, `
                INSERT INTO transaccionDetalle(
                    idTransaccionDetalle,
                    idTransaccion,
                    idBanco,
                    monto,
                    observacion
                ) VALUES(?,?,?,?,?)`, [
                    idTransaccionDetalle,
                    idTransaccion,
                    item.idBanco,
                    item.monto,
                    item.observacion
                ]);

                idTransaccionDetalle++;
            }

            await conec.commit(connection);
            return sendSuccess(res, "Se registró correctamente su pago.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/createAccountsPayable", error);
        }
    }

    async cancelAccountsPayable(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const date = currentDate();
            const time = currentTime();

            const transaccion = await conec.execute(connection, `
                SELECT 
                    SUM(td.monto) AS monto
                FROM 
                    transaccion AS t
                INNER JOIN
                    transaccionDetalle AS td ON td.idTransaccion = t.idTransaccion
                WHERE 
                    t.idTransaccion = ?`, [
                req.query.idTransaccion,
            ]);

            const transacciones = await conec.execute(connection, `
                SELECT 
                    SUM(td.monto) AS monto
                FROM 
                    transaccion AS t
                INNER JOIN
                    transaccionDetalle AS td ON td.idTransaccion = t.idTransaccion
                WHERE 
                    t.idReferencia = ? AND t.estado = 1`, [
                req.query.idCompra
            ]);

            const sumaTransacciones = transacciones.reduce((accumulator, item) => accumulator + item.monto, 0);

            const compra = await conec.query(`
                SELECT 
                    SUM(cd.cantidad * cd.costo) AS total
                FROM 
                    compra AS c 
                INNER JOIN 
                    compraDetalle AS cd ON cd.idCompra = c.idCompra
                WHERE 
                    c.idCompra = ?`, [
                req.query.idCompra
            ]);

            if (sumaTransacciones - transaccion[0].monto < compra[0].total) {
                await conec.execute(connection, `
                UPDATE 
                    compra
                SET 
                    estado = 2
                WHERE 
                    idCompra = ?`, [
                    req.query.idCompra
                ]);
            }

            await conec.execute(connection, `
                UPDATE 
                    transaccion 
                SET 
                    estado = 0 
                WHERE 
                    idTransaccion = ?`, [
                req.query.idTransaccion
            ]);

            await conec.execute(connection, `    
            INSERT INTO auditoria(
                idReferencia,
                idUsuario,
                tipo,
                descripción
            ) VALUES(?,?,?,?)`, [
                req.query.idTransaccion,
                req.query.idUsuario,
                "ELIMINAR",
                "SE ANULO LA TRANSACCIÓN DE COMPRA",
                date,
                time,
            ]);

            await conec.commit(connection);
            return sendSuccess(res, "Se anuló correctamente su pago.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Factura/createAccountsPayable", error);
        }
    }

    async dashboard(req, res) {
        try {
            const result = await conec.procedureAll(`CALL Dashboard_Compra(?,?,?,?,?,?)`, [
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idSucursal,
                req.query.idUsuario,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            return sendSuccess(res, {
                "contado": result[0][0].total ?? 0,
                "credito": result[1][0].total ?? 0,
                "anulado": result[2][0].total ?? 0,
                "lista": result[3] ?? [],
                "total": result[4][0].total ?? 0,
            });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Compra/test", error);
        }
    }

    async pdfDocumentOrPreview(req, res) {
        try {
            const { idCompra, type, size } = req.params;

            const empresa = await conec.query(`
            SELECT
                documento,
                razonSocial,
                nombreEmpresa,
                rutaLogo,
                paginaWeb,
                tipoEnvio
            FROM 
                empresa`);

            if (empresa.length === 0) {
                throw new ClientError("No se pudo obtener datos de empresa, vuelve a recargar la vista.");
            }

            const compra = await conec.query(`
            SELECT 
                DATE_FORMAT(p.fecha, '%d/%m/%Y') AS fecha, 
                p.hora,
                p.idSucursal,
                p.nota,
                --
                c.nombre AS comprobante,
                p.serie,
                p.numeracion,
                --
                cp.documento,
                cp.informacion,
                cp.direccion,
                --
                m.nombre AS moneda,
                m.simbolo,
                m.codiso,
                --
                u.apellidos,
                u.nombres
            FROM 
                compra AS p
            INNER JOIN
                comprobante AS c ON c.idComprobante = p.idComprobante
            INNER JOIN
                persona AS cp ON cp.idPersona = p.idProveedor
            INNER JOIN
                moneda AS m ON m.idMoneda = p.idMoneda
            INNER JOIN
                usuario AS u ON u.idUsuario = p.idUsuario
            WHERE 
                p.idCompra = ?`, [
                idCompra
            ]);

            if (compra.length === 0) {
                throw new ClientError("No se pudo obtener datos de la compra, vuelve a recargar la vista.");
            }

            const sucursal = await conec.query(`
            SELECT 
                s.nombre,
                s.telefono,
                s.celular,
                s.email,
                s.direccion,

                ub.departamento,
                ub.provincia,
                ub.distrito
            FROM 
                sucursal AS s
            INNER JOIN
                ubigeo AS ub ON ub.idUbigeo = s.idUbigeo
            WHERE 
                s.idSucursal = ?`, [
                compra[0].idSucursal
            ]);

            if (sucursal.length === 0) {
                throw new ClientError("No se pudo obtener datos del sucursal, vuelve a recargar la vista.")
            }

            const detalles = await conec.query(` 
            SELECT 
                ROW_NUMBER() OVER (ORDER BY gd.idCompraDetalle ASC) AS id,
                p.codigo,
                p.nombre,
                p.imagen,
                gd.cantidad,
                gd.costo,
                m.nombre AS medida,
                i.idImpuesto,
                i.nombre AS impuesto,
                i.porcentaje
            FROM 
                compraDetalle AS gd
            INNER JOIN 
                producto AS p ON gd.idProducto = p.idProducto
            INNER JOIN 
                medida AS m ON m.idMedida = p.idMedida
            INNER JOIN
                impuesto AS i ON i.idImpuesto = gd.idImpuesto
            WHERE 
                gd.idCompra = ?
            ORDER BY 
                gd.idCompraDetalle ASC`, [
                idCompra
            ]);

            const bancos = await conec.query(`
            SELECT 
                nombre,
                numCuenta,
                cci
            FROM
                banco
            WHERE 
                reporte = 1 AND idSucursal = ?`, [
                compra[0].idSucursal
            ]);

            const subTotal = detalles.reduce((accumulator, item) => {
                const total = item.costo * item.cantidad;
                return accumulator + calculateTaxBruto(item.porcentaje, total);
            }, 0);

            const impuestos = detalles.reduce((
                accumulator,
                item,
            ) => {
                const total = item.cantidad * item.costo;
                const subTotal = calculateTaxBruto(item.porcentaje, total);
                const monto = calculateTax(item.porcentaje, subTotal);

                const existingImpuesto = accumulator.find(
                    (imp) => imp.idImpuesto === item.idImpuesto,
                );

                if (existingImpuesto) {
                    existingImpuesto.monto += monto;
                } else {
                    const tax = {
                        idImpuesto: item.idImpuesto,
                        nombre: item.impuesto,
                        monto: monto,
                    };
                    accumulator.push(tax);
                }

                return accumulator;
            },
                [],
            );

            const total = detalles.reduce(
                (accumulator, item) => accumulator + item.costo * item.cantidad,
                0,
            );

            const numeracion = formatNumberWithZeros(
                compra[0].numeracion,
            );
            const title = `COMPRA ${compra[0].serie}-${numeracion} - ${compra[0].informacion}`;

            const template =
                type === 'document'
                    ? size === 'A4' ? 'compra/document/a4' : 'compra/document/ticket'
                    : 'compra/preview/a4';

            const html = await renderTemplate(template, {
                formatDecimal,
                style: cssUrl,
                icon: logoUrl,
                title: title,
                empresa: {
                    ...empresa[0],
                    rutaLogo: firebaseService.getUrl(empresa[0].rutaLogo),
                },
                sucursal: {
                    nombre: sucursal[0].nombre,
                    telefono: sucursal[0].telefono,
                    celular: sucursal[0].celular,
                    email: sucursal[0].email,
                    paginaWeb: empresa[0].paginaWeb,
                    direccion: sucursal[0].direccion,
                    ubigeo: {
                        departamento: sucursal[0].departamento,
                        provincia: sucursal[0].provincia,
                        distrito: sucursal[0].distrito
                    } 
                },
                compra: {
                    fecha: compra[0].fecha,
                    hora: compra[0].hora,
                    nota: compra[0].nota,
                    comprobante: {
                        nombre: compra[0].comprobante,
                        serie: compra[0].serie,
                        numeracion: compra[0].numeracion
                    },
                    proveedor: {
                        documento: compra[0].documento,
                        informacion: compra[0].informacion,
                        direccion: compra[0].direccion
                    },
                    moneda: {
                        nombre: compra[0].moneda,
                        simbolo: compra[0].simbolo,
                        codiso: compra[0].codiso
                    },
                    usuario: {
                        apellidos: compra[0].apellidos,
                        nombres: compra[0].nombres
                    },
                },
                detalles: detalles.map(item => {
                    return {
                        id: item.id,
                        cantidad: item.cantidad,
                        costo: item.costo,
                        producto: {
                            codigo: item.codigo,
                            nombre: item.nombre,
                        },
                        medida: {
                            nombre: item.medida,
                        },
                        impuesto: {
                            idImpuesto: item.idImpuesto,
                            nombre: item.impuesto,
                            porcentaje: item.porcentaje,
                        },

                    }
                }),
                subTotal,
                impuestos,
                total,
                importLetras: new NumberLleters().getResult(
                    String(rounded(total)),
                    compra[0].moneda,
                ),
                bancos: bancos
            });

            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/html-to-pdf`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    title: title,
                    htmlContent: html,
                    paper: {
                        paperType: size,
                        width: 0,
                        height: 0,
                    },
                    outputType: 'pdf'
                },
                timeout: 60000,
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            if (error instanceof ClientError) {
                return sendClient(res, error.message, "Compra/pdfDocumentOrPreview", error);
            }

            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Compra/pdfDocumentOrPreview", error);

        }
    }

    async documentsPdfAccountsPayable(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/purchase/pdf/account/payable`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    "size": req.params.size
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Compra/documentsPdfAccountsPayable", error);
        }
    }

    async documentsPdfReports(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/purchase/pdf/reports`,
                headers: {
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Compra/documentsPdfReports", error);
        }
    }

    async documentsPdfExcel(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/purchase/excel`,
                headers: {
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Compra/documentsPdfExcel", error);
        }
    }

}

module.exports = Compra;