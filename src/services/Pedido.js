const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode, sleep } = require('../tools/Tools');
const { sendSuccess, sendError, sendSave, sendFile, sendClient } = require('../tools/Message');
const Conexion = require('../database/Conexion');
const { default: axios } = require('axios');
const FirebaseService = require('../tools/FiraseBaseService');
const conec = new Conexion();
const firebaseService = new FirebaseService();

class Pedido {

    async list(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Pedidos(?,?,?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idSucursal,
                parseInt(req.query.estado),

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_Pedidos_Count(?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idSucursal,
                parseInt(req.query.estado),
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Pedido/list", error)
        }
    }

    async id(req, res) {
        try {
            const { idPedido } = req.params;

            const cabecera = await conec.query(`
            SELECT 
                p.idPersona,
                p.documento,
                p.informacion,
                p.celular,
                p.email,
                p.direccion,
                c.idComprobante,
                c.idMoneda,
                c.observacion,
                c.nota,
                c.instruccion,
                c.idTipoEntrega,
                c.idTipoPedido,
                c.fechaPedido,
                c.horaPedido
            FROM 
                pedido AS c
            INNER JOIN 
                persona AS p ON p.idPersona = c.idCliente
            WHERE 
                c.idPedido = ?`, [
                idPedido
            ]);

            const detalles = await conec.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY cd.idPedidoDetalle ASC) AS id,
                cd.cantidad,
                cd.idImpuesto,
                p.idMedida,
                p.idProducto,
                p.codigo,
                p.nombre,
                p.imagen,
                i.nombre AS nombreImpuesto,
                m.nombre AS nombreMedida,
                i.porcentaje AS porcentajeImpuesto,
                cd.precio,
                tp.nombre as tipoProducto,
                p.idTipoTratamientoProducto
            from 
                pedidoDetalle AS cd
            INNER JOIN 
                producto AS p ON cd.idProducto = p.idProducto
            INNER JOIN 
                tipoProducto AS tp ON tp.idTipoProducto = p.idTipoProducto
            INNER JOIN 
                medida AS m ON m.idMedida = p.idMedida
            INNER JOIN 
                impuesto AS i ON cd.idImpuesto = i.idImpuesto
            WHERE 
                cd.idPedido = ?
            ORDER BY 
                cd.idPedidoDetalle ASC`, [
                idPedido
            ]);

            const bucket = firebaseService.getBucket();
            const listaDetalles = detalles.map(item => {
                return {
                    ...item,
                    imagen: bucket && item.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : null,
                }
            });

            const idImpuesto = detalles[0]?.idImpuesto ?? '';
            cabecera[0].idImpuesto = idImpuesto;

            return sendSuccess(res, { cabecera: cabecera[0], detalles: listaDetalles });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Pedido/id", error)
        }
    }

    async detail(req, res) {
        try {
            const { idPedido } = req.params;

            // Consulta la información principal del pedido
            const pedido = await conec.query(`
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
                c.estado,
                c.observacion,
                c.nota,
                c.instruccion,
                c.idTipoEntrega,
                te.nombre AS tipoEntrega,
                
                c.idTipoPedido,
                tp.nombre AS tipoPedido,
                c.fechaPedido,
                c.horaPedido,
                mo.codiso,
                CONCAT(us.nombres,' ',us.apellidos) AS usuario
            FROM 
                pedido AS c
            INNER JOIN 
                comprobante AS co ON co.idComprobante = c.idComprobante
            INNER JOIN 
                moneda AS mo ON mo.idMoneda = c.idMoneda
            INNER JOIN 
                persona AS cn ON cn.idPersona = c.idCliente
            INNER JOIN 
                usuario AS us ON us.idUsuario = c.idUsuario 
            LEFT JOIN 
                tipoEntrega AS te ON te.idTipoEntrega = c.idTipoEntrega
            LEFT JOIN 
                tipoPedido AS tp ON tp.idTipoPedido = c.idTipoPedido
            WHERE 
                c.idPedido = ?`, [
                idPedido
            ]);

            // Consulta los detalles del pedido
            const detalles = await conec.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY cd.idPedidoDetalle ASC) AS id,
                p.imagen,
                p.codigo,
                p.nombre AS producto,
                md.nombre AS medida, 
                m.nombre AS categoria, 
                cd.precio,
                cd.cantidad,
                cd.idImpuesto,
                imp.nombre AS impuesto,
                imp.porcentaje
            FROM 
                pedidoDetalle AS cd 
            INNER JOIN 
                producto AS p ON cd.idProducto = p.idProducto 
            INNER JOIN 
                medida AS md ON md.idMedida = cd.idMedida 
            INNER JOIN 
                categoria AS m ON p.idCategoria = m.idCategoria 
            INNER JOIN 
                impuesto AS imp ON cd.idImpuesto = imp.idImpuesto 
            WHERE
                cd.idPedido = ?
            ORDER BY 
                cd.idPedidoDetalle ASC`, [
                idPedido
            ]);

            const bucket = firebaseService.getBucket();
            const listaDetalles = detalles.map(item => {
                return {
                    ...item,
                    imagen: bucket && item.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : null,
                }
            });

            // Consulta los ventas asociadas
            const ventas = await conec.query(`
                SELECT 
                    ROW_NUMBER() OVER (ORDER BY v.idVenta DESC) AS id,
                    v.idVenta,
                    DATE_FORMAT(v.fecha, '%d/%m/%Y') AS fecha,
                    v.hora,
                    co.nombre AS comprobante,
                    v.serie,
                    v.numeracion,
                    v.estado,
                    m.codiso,
                    SUM(vd.precio * vd.cantidad) AS total
                FROM 
                    ventaPedido AS vc 
                INNER JOIN 
                    pedido AS c ON c.idPedido = vc.idPedido
                INNER JOIN 
                    venta AS v ON v.idVenta = vc.idVenta AND v.estado <> 3
                INNER JOIN 
                    moneda AS m ON v.idMoneda = m.idMoneda
                INNER JOIN 
                    ventaDetalle AS vd ON vd.idVenta = v.idVenta
                INNER JOIN 
                    comprobante AS co ON co.idComprobante = v.idComprobante
                WHERE 
                    vc.idPedido = ? 
                GROUP BY 
                    v.idVenta, v.fecha, v.hora, co.nombre, v.serie, v.numeracion, v.estado,  m.codiso
                ORDER BY 
                    v.fecha DESC, v.hora DESC`, [
                idPedido
            ]);

            const vendidos = await conec.query(`
                SELECT 
                    p.idProducto,
                    SUM(vd.cantidad) AS cantidad
                FROM 
                    ventaPedido AS vc
                INNER JOIN
                    venta AS v ON v.idVenta = vc.idVenta AND v.estado <> 3
                INNER JOIN
                    ventaDetalle AS vd ON vd.idVenta = v.idVenta
                INNER JOIN
                    producto AS p ON p.idProducto = vd.idProducto
                WHERE 
                    vc.idPedido = ?
                GROUP BY 
                    p.idProducto`, [
                idPedido
            ]);

            // Devuelve un objeto con la información del pedido y los detalles 
            return sendSuccess(res, { cabecera: pedido[0], detalles: listaDetalles, ventas, vendidos });
        } catch (error) {
            // Manejo de errores: Si hay un error, devuelve un mensaje de error
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Pedido/detail", error)
        }
    }

    async forSale(req, res) {
        try {
            const validate = await conec.query(`
                SELECT 
                    *
                FROM 
                    pedido
                WHERE 
                    idPedido = ? AND estado = 0`, [
                req.query.idPedido
            ]);

            if (validate.length !== 0) {
                return sendClient(res, "El pedido se encuentra anulado.");
            }

            const cliente = await conec.query(`
            SELECT                 
                p.idPersona,
                p.idTipoCliente,     
                p.idTipoDocumento,
                p.documento, 
                p.informacion,
                IFNULL(p.celular,'') AS celular,
                IFNULL(p.email,'') AS email,
                IFNULL(p.direccion,'') AS direccion
            FROM 
                pedido AS c
            INNER JOIN 
                persona AS p ON p.idPersona = c.idCliente
            WHERE 
                c.idPedido = ?`, [
                req.query.idPedido
            ]);

            const vendidos = await conec.query(`
                SELECT 
                    p.idProducto,
                    SUM(vd.cantidad) AS cantidad
                FROM 
                    ventaPedido AS vc
                INNER JOIN
                    venta AS v ON v.idVenta = vc.idVenta AND v.estado <> 3
                INNER JOIN
                    ventaDetalle AS vd ON vd.idVenta = v.idVenta
                INNER JOIN
                    producto AS p ON p.idProducto = vd.idProducto
                WHERE 
                    vc.idPedido = ?
                GROUP BY 
                    p.idProducto`, [
                req.query.idPedido
            ]);

            const detalles = await conec.query(`
                SELECT 
                    cd.idProducto,
                    cd.precio,
                    cd.cantidad
                FROM
                    pedidoDetalle AS cd
                WHERE
                    cd.idPedido = ?
                ORDER BY 
                    cd.idPedidoDetalle ASC`, [
                req.query.idPedido
            ]);

            const newDetalles = detalles
                .map((detalle) => {
                    const item = vendidos.find(pro => pro.idProducto === detalle.idProducto);
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
                })
                .filter(Boolean);

            let productos = [];

            let index = 0;
            for (const item of newDetalles) {
                const producto = await conec.query(`
                SELECT 
                    p.idProducto, 
                    p.codigo,
                    p.nombre AS nombreProducto, 
                    p.preferido,
                    p.negativo,
                    c.nombre AS categoria, 
                    m.nombre AS medida,
                    p.idTipoTratamientoProducto,
                    p.imagen,
                    a.nombre AS almacen,
                    i.idInventario,
                    'PRODUCTO' AS tipo
                FROM 
                    producto AS p
                INNER JOIN 
                    precio AS pc ON p.idProducto = pc.idProducto AND pc.preferido = 1
                INNER JOIN 
                    categoria AS c ON p.idCategoria = c.idCategoria
                INNER JOIN 
                    medida AS m ON m.idMedida = p.idMedida
                INNER JOIN 
                    inventario AS i ON i.idProducto = p.idProducto 
                INNER JOIN 
                    almacen AS a ON a.idAlmacen = i.idAlmacen
                WHERE 
                    p.idProducto = ? AND a.idAlmacen = ?
                UNION
                SELECT 
                    p.idProducto, 
                    p.codigo,
                    p.nombre AS nombreProducto, 
                    p.preferido,
                    p.negativo,
                    c.nombre AS categoria, 
                    m.nombre AS medida,
                    p.idTipoTratamientoProducto,
                    p.imagen,
                    'SIN ALMACEN' AS almacen,
                    0 AS idInventario,
                    'SERVICIO' AS tipo
                FROM 
                    producto AS p
                INNER JOIN 
                    precio AS pc ON p.idProducto = pc.idProducto AND pc.preferido = 1
                INNER JOIN 
                    categoria AS c ON p.idCategoria = c.idCategoria
                INNER JOIN 
                    medida AS m ON m.idMedida = p.idMedida
                WHERE 
                    p.idProducto = ?`, [
                    item.idProducto,
                    req.query.idAlmacen,
                    item.idProducto
                ]);

                const bucket = firebaseService.getBucket();
                const newProducto = {
                    ...producto[0],
                    precio: item.precio,
                    cantidad: item.cantidad,
                    imagen: bucket && producto[0].imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${producto[0].imagen}` : null,
                    id: index + 1
                }

                productos.push(newProducto);
            }

            // Devuelve un objeto con la información de la compra, los detalles y las salidas
            return sendSuccess(res, { cliente: cliente[0], productos });
        } catch (error) {
            // Manejo de errores: Si hay un error, devuelve un mensaje de error
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "OrdenCompra/detailVenta", error)
        }
    }

    async create(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            // Genera un nuevo ID para el pedido
            const result = await conec.execute(connection, 'SELECT idPedido FROM pedido');
            const idPedido = generateAlphanumericCode("PD0001", result, 'idPedido');

            // Consulta datos del comprobante para generar la numeración
            const comprobante = await conec.execute(connection, `
            SELECT 
                serie,
                numeracion 
            FROM 
                comprobante 
            WHERE 
                idComprobante  = ?`, [
                req.body.idComprobante
            ]);

            // Consulta numeraciones de los pedidos  asociadas al mismo comprobante
            const pedidos = await conec.execute(connection, `
            SELECT 
                numeracion  
            FROM 
                pedido 
            WHERE 
                idComprobante = ?`, [
                req.body.idComprobante
            ]);

            // Genera una nueva numeración para el pedido
            const numeracion = generateNumericCode(comprobante[0].numeracion, pedidos, "numeracion");

            await conec.execute(connection, `INSERT INTO pedido(
                idPedido,
                idCliente,
                idUsuario,
                idComprobante,
                idSucursal,
                idMoneda,
                serie,
                numeracion,
                idTipoEntrega,
                idTipoPedido,
                fechaPedido,
                horaPedido,
                observacion,
                nota,
                instruccion,
                estado,
                fecha,
                hora
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idPedido,
                req.body.idCliente,
                req.body.idUsuario,
                req.body.idComprobante,
                req.body.idSucursal,
                req.body.idMoneda,
                comprobante[0].serie,
                numeracion,
                req.body.idTipoEntrega,
                req.body.idTipoPedido,
                req.body.fechaPedido || currentDate(),
                req.body.horaPedido || currentTime(),
                req.body.observacion,
                req.body.nota,
                req.body.instruccion,
                req.body.estado,
                currentDate(),
                currentTime(),
            ]);

            // Genera un nuevo ID para los detalles del pedido
            const listaPedidoDetalle = await conec.execute(connection, 'SELECT idPedidoDetalle FROM pedidoDetalle');
            let idPedidoDetalle = generateNumericCode(1, listaPedidoDetalle, 'idPedidoDetalle');

            // Inserta los detalles de compra en la base de datos
            for (const item of req.body.detalles) {
                await await conec.execute(connection, `INSERT INTO pedidoDetalle(
                    idPedidoDetalle,
                    idPedido,
                    idProducto,
                    idMedida,
                    precio,
                    cantidad,
                    idImpuesto
                ) VALUES(?,?,?,?,?,?,?)`, [
                    idPedidoDetalle,
                    idPedido,
                    item.idProducto,
                    item.idMedida,
                    item.precio,
                    item.cantidad,
                    item.idImpuesto
                ]);

                idPedidoDetalle++;
            }

            await conec.commit(connection);
            return sendSave(res, {
                idPedido: idPedido,
                message: "Se registró correctamente el pedido."
            });
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Pedido/create", error)
        }
    }

    async createWeb(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const persona = await conec.execute(connection, 'SELECT * FROM persona WHERE documento = ?', [
                req.body.documento
            ]);

            let idCliente = "";

            if (persona.length === 0) {
                const result = await conec.execute(connection, 'SELECT idPersona FROM persona');
                const idPersona = generateAlphanumericCode("PN0001", result, 'idPersona');

                await conec.execute(connection, `INSERT INTO persona(
                idPersona, 
                idTipoCliente,
                idTipoDocumento,
                documento,
                informacion,

                cliente,
                proveedor,
                conductor,
                licenciaConducir,

                celular,
                telefono,
                fechaNacimiento,
                email, 
                genero, 
                direccion,
                idUbigeo, 
                estadoCivil,
                predeterminado,
                estado, 
                observacion,
                fecha,
                hora,
                fupdate,
                hupdate,
                idUsuario
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                    idPersona,
                    "TC0001",
                    "TD0001",
                    req.body.documento,
                    req.body.informacion,

                    true,
                    false,
                    false,
                    "",

                    req.body.celular,
                    req.body.telefono,
                    null,
                    req.body.email,
                    null,
                    req.body.direccion,
                    null,
                    null,
                    false,
                    true,
                    "",
                    currentDate(),
                    currentTime(),
                    currentDate(),
                    currentTime(),
                    req.body.idUsuario,
                ]);

                idCliente = idPersona;
            }else{
                idCliente = persona[0].idPersona;
            }

            // Genera un nuevo ID para el pedido
            const result = await conec.execute(connection, 'SELECT idPedido FROM pedido');
            const idPedido = generateAlphanumericCode("PD0001", result, 'idPedido');

            // Consulta datos del comprobante para generar la numeración
            const comprobante = await conec.execute(connection, `
            SELECT 
                serie,
                numeracion 
            FROM 
                comprobante 
            WHERE 
                idComprobante  = ?`, [
                req.body.idComprobante
            ]);

            // Consulta numeraciones de los pedidos  asociadas al mismo comprobante
            const pedidos = await conec.execute(connection, `
            SELECT 
                numeracion  
            FROM 
                pedido 
            WHERE 
                idComprobante = ?`, [
                req.body.idComprobante
            ]);

            // Genera una nueva numeración para el pedido
            const numeracion = generateNumericCode(comprobante[0].numeracion, pedidos, "numeracion");

            await conec.execute(connection, `INSERT INTO pedido(
                idPedido,
                idCliente,
                idUsuario,
                idComprobante,
                idSucursal,
                idMoneda,
                serie,
                numeracion,
                idTipoEntrega,
                idTipoPedido,
                fechaPedido,
                horaPedido,
                observacion,
                nota,
                instruccion,
                estado,
                fecha,
                hora
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idPedido,
                idCliente,
                req.body.idUsuario,
                req.body.idComprobante,
                req.body.idSucursal,
                req.body.idMoneda,
                comprobante[0].serie,
                numeracion,
                req.body.idTipoEntrega,
                req.body.idTipoPedido,
                req.body.fechaPedido || currentDate(),
                req.body.horaPedido || currentTime(),
                req.body.observacion,
                req.body.nota,
                req.body.instruccion,
                req.body.estado,
                currentDate(),
                currentTime(),
            ]);

            // Genera un nuevo ID para los detalles del pedido
            const listaPedidoDetalle = await conec.execute(connection, 'SELECT idPedidoDetalle FROM pedidoDetalle');
            let idPedidoDetalle = generateNumericCode(1, listaPedidoDetalle, 'idPedidoDetalle');

            // Inserta los detalles de compra en la base de datos
            for (const item of req.body.detalles) {
                await await conec.execute(connection, `INSERT INTO pedidoDetalle(
                    idPedidoDetalle,
                    idPedido,
                    idProducto,
                    idMedida,
                    precio,
                    cantidad,
                    idImpuesto
                ) VALUES(?,?,?,?,?,?,?)`, [
                    idPedidoDetalle,
                    idPedido,
                    item.idProducto,
                    item.idMedida,
                    item.precio,
                    item.cantidad,
                    item.idImpuesto
                ]);

                idPedidoDetalle++;
            }

            await conec.commit(connection);
            return sendSave(res, {
                idPedido: idPedido,
                message: "Se registró correctamente el pedido."
            });
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Pedido/create", error)
        }
    }

    async update(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const validate = await conec.execute(connection, `
            SELECT 
                *
            FROM 
                ventaPedido AS vc
            INNER JOIN
                venta AS v ON v.idVenta = vc.idVenta AND v.estado <> 3
            WHERE 
                vc.idPedido = ?`, [
                req.body.idPedido,
            ]);

            if (validate.length !== 0) {
                await conec.rollback(connection);
                return sendClient(res, "El pedido ya esta ligado a una venta y no se puede editar.");
            }

            await conec.execute(connection, `
            UPDATE 
                pedido 
            SET
                idCliente = ?,
                idUsuario = ?,
                idSucursal = ?,
                idMoneda = ?,
                observacion = ?,
                nota = ?,
                instruccion = ?,
                idTipoEntrega = ?,
                idTipoPedido = ?,
                fechaPedido = ?,
                horaPedido = ?,
                estado = ?,
                fecha = ?,
                hora = ?
            WHERE 
                idPedido = ?`, [
                req.body.idCliente,
                req.body.idUsuario,
                req.body.idSucursal,
                req.body.idMoneda,
                req.body.observacion,
                req.body.nota,
                req.body.instruccion,
                req.body.idTipoEntrega,
                req.body.idTipoPedido,
                req.body.fechaPedido,
                req.body.horaPedido,
                req.body.estado,
                currentDate(),
                currentTime(),
                req.body.idPedido,
            ]);

            await conec.execute(connection, `
            DELETE FROM 
                pedidoDetalle
            WHERE 
                idPedido = ?`, [
                req.body.idPedido,
            ]);

            const listaPedidoDetalle = await conec.execute(connection, 'SELECT idPedidoDetalle FROM pedidoDetalle');
            let idPedidoDetalle = generateNumericCode(1, listaPedidoDetalle, 'idPedidoDetalle');

            // Inserta los detalles del pedido en la base de datos
            for (const item of req.body.detalles) {
                await await conec.execute(connection, `
                INSERT INTO pedidoDetalle(
                    idPedidoDetalle,
                    idPedido,
                    idProducto,
                    idMedida,
                    precio,
                    cantidad,
                    idImpuesto
                ) VALUES(?,?,?,?,?,?,?)`, [
                    idPedidoDetalle,
                    req.body.idPedido,
                    item.idProducto,
                    item.idMedida,
                    item.precio,
                    item.cantidad,
                    item.idImpuesto
                ]);

                idPedidoDetalle++;
            }

            await conec.commit(connection);
            return sendSave(res, {
                idPedido: req.body.idPedido,
                message: "Se actualizó correctamente el pedido."
            });
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Pedido /update", error)
        }
    }

    async cancel(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const validate = await conec.execute(connection, `
            SELECT 
                *
            FROM 
                ventaPedido AS vc
            INNER JOIN
                venta AS v ON v.idVenta = vc.idVenta AND v.estado <> 3
            WHERE 
                vc.idPedido = ?`, [
                req.query.idPedido
            ]);

            if (validate.length !== 0) {
                await conec.rollback(connection);
                return sendClient(res, "El pedido ya esta ligado a una venta y no se puede anular.");
            }

            const pedido = await conec.execute(connection, `
            SELECT
                estado
            FROM
                pedido
            WHERE
                idPedido = ?`, [
                req.query.idPedido
            ]);

            if (pedido.length === 0) {
                await conec.rollback(connection);
                return sendClient(res, "No se encontro registros del pedido.");
            }

            if (pedido[0].estado === 0) {
                await conec.rollback(connection);
                return sendClient(res, "El pedido ya se encuentra anulado.");
            }

            await conec.execute(connection, `
            UPDATE 
                pedido
            SET 
                estado = 0
            WHERE
                idPedido = ?`, [
                req.query.idPedido
            ]);

            await conec.commit(connection);
            return sendSave(res, "Se anuló correctamente el pedido.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Pedido/cancel", error)
        }
    }

    async documentsPdfInvoicesOrList(req, res) {
        try {
            const { idPedido, size } = req.params;

            const bucket = firebaseService.getBucket();

            const empresa = await conec.query(`
            SELECT
                documento,
                razonSocial,
                nombreEmpresa,
                rutaLogo,
                tipoEnvio
            FROM 
                empresa`);

            const pedido = await conec.query(`
            SELECT 
                DATE_FORMAT(p.fecha, '%d/%m/%Y') AS fecha, 
                p.hora,
                p.idSucursal,
                p.nota,

                c.nombre AS comprobante,
                p.serie,
                p.numeracion,

                cp.documento,
                cp.informacion,
                cp.direccion,

                m.nombre AS moneda,
                m.simbolo,
                m.codiso,

                u.apellidos,
                u.nombres
            FROM 
                pedido AS p
            INNER JOIN
                comprobante AS c ON c.idComprobante = p.idComprobante
            INNER JOIN
                persona AS cp ON cp.idPersona = p.idCliente
            INNER JOIN
                moneda AS m ON m.idMoneda = p.idMoneda
            INNER JOIN
                usuario AS u ON u.idUsuario = p.idUsuario
            WHERE 
                p.idPedido = ?`, [
                idPedido
            ]);

            const sucursal = await conec.query(`
            SELECT 
                s.nombre,
                s.telefono,
                s.celular,
                s.email,
                s.paginaWeb,
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
                pedido[0].idSucursal
            ]);

            const detalles = await conec.query(` 
            SELECT 
                ROW_NUMBER() OVER (ORDER BY gd.idPedidoDetalle ASC) AS id,
                p.codigo,
                p.nombre,
                p.imagen,
                gd.cantidad,
                gd.precio,
                m.nombre AS medida,
                i.idImpuesto,
                i.nombre AS impuesto,
                i.porcentaje
            FROM 
                pedidoDetalle AS gd
            INNER JOIN 
                producto AS p ON gd.idProducto = p.idProducto
            INNER JOIN 
                medida AS m ON m.idMedida = p.idMedida
            INNER JOIN
                impuesto AS i ON i.idImpuesto = gd.idImpuesto
            WHERE 
                gd.idPedido = ?
            ORDER BY 
                gd.idPedidoDetalle ASC`, [
                idPedido
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
                pedido[0].idSucursal
            ]);

            return {
                "size": size,
                "company": {
                    ...empresa[0],
                    rutaLogo: empresa[0].rutaLogo ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${empresa[0].rutaLogo}` : null,
                },
                "branch": {
                    "nombre": sucursal[0].nombre,
                    "telefono": sucursal[0].telefono,
                    "celular": sucursal[0].celular,
                    "email": sucursal[0].email,
                    "paginaWeb": sucursal[0].paginaWeb,
                    "direccion": sucursal[0].direccion,
                    "ubigeo": {
                        "departamento": sucursal[0].departamento,
                        "provincia": sucursal[0].provincia,
                        "distrito": sucursal[0].distrito
                    }
                },
                "order": {
                    "fecha": pedido[0].fecha,
                    "hora": pedido[0].hora,
                    "nota": pedido[0].nota,
                    "comprobante": {
                        "nombre": pedido[0].comprobante,
                        "serie": pedido[0].serie,
                        "numeracion": pedido[0].numeracion
                    },
                    "cliente": {
                        "documento": pedido[0].documento,
                        "informacion": pedido[0].informacion,
                        "direccion": pedido[0].direccion
                    },
                    "moneda": {
                        "nombre": pedido[0].moneda,
                        "simbolo": pedido[0].simbolo,
                        "codiso": pedido[0].codiso
                    },
                    "usuario": {
                        "apellidos": pedido[0].apellidos,
                        "nombres": pedido[0].nombres
                    },
                    "pedidoDetalles": detalles.map(item => {
                        return {
                            "id": item.id,
                            "cantidad": item.cantidad,
                            "precio": item.precio,
                            "producto": {
                                "codigo": item.codigo,
                                "nombre": item.nombre,
                                "imagen": item.imagen && bucket ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : `${process.env.APP_URL}/files/to/noimage.png`,
                            },
                            "medida": {
                                "nombre": item.medida,
                            },
                            "impuesto": {
                                "idImpuesto": item.idImpuesto,
                                "nombre": item.impuesto,
                                "porcentaje": item.porcentaje,
                            },

                        }
                    }),
                },
                "banks": bancos
            };
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async documentsPdfReports(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/order/pdf/reports`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {

                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Pedido/documentsPdfReports", error);
        }
    }

    async documentsPdfExcel(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/order/excel`,
                headers: {
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Pedido/documentsPdfExcel", error);
        }
    }
}

module.exports = Pedido;