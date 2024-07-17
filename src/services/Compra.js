const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode, sleep, } = require('../tools/Tools');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Compra {

    async list(req) {
        try {
            const lista = await conec.procedure(`CALL Listar_Compras(?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

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

            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async create(req) {
        let connection = null;
        try {
            // Inicia la transacción
            connection = await conec.beginTransaction();

            // Extrae los datos del cuerpo de la solicitud
            const {
                idFormaPago,
                idComprobante,
                idProveedor,
                idUsuario,
                idSucursal,
                idAlmacen,
                idMoneda,
                observacion,
                nota,
                estado,
                detalles,
                metodoPago
            } = req.body;

            // Genera un nuevo ID para la compra
            const resultCompra = await conec.execute(connection, `
            SELECT 
                idCompra 
            FROM 
                compra`);
            const idCompra = generateAlphanumericCode("CP0001", resultCompra, 'idCompra');

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
                observacion,
                nota,
                estado,
                fecha,
                hora
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
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
                observacion,
                nota,
                estado,
                currentDate(),
                currentTime()
            ]);

            // Genera un nuevo ID para los detalles de compra
            const listaCompraDetalle = await conec.execute(connection, `
            SELECT 
                idCompraDetalle 
            FROM 
                compraDetalle`);
            let idCompraDetalle = generateNumericCode(1, listaCompraDetalle, 'idCompraDetalle');

            // Consulta el último ID de Kardex
            const resultKardex = await conec.execute(connection, `
            SELECT 
                idKardex 
            FROM 
                kardex`);
            let idKardex = 0;

            if (resultKardex.length != 0) {
                const quitarValor = resultKardex.map(item => parseInt(item.idKardex.replace("KD", '')));
                idKardex = Math.max(...quitarValor);
            }

            // Inserta los detalles de compra en la base de datos
            for (const item of detalles) {
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

                // Insertar kardex
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
                    item.cantidad,
                    item.idImpuesto
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
                    hora,
                    fecha,
                    idUsuario
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                    `KD${String(idKardex += 1).padStart(4, '0')}`,
                    item.idProducto,
                    'TK0001',
                    'MK0002',
                    idCompra,
                    'INGRESO POR COMPRA',
                    item.cantidad,
                    item.costo,
                    idAlmacen,
                    inventario[0].idInventario,
                    currentTime(),
                    currentDate(),
                    idUsuario
                ]);

                // Actualiza el inventario
                await conec.execute(connection, `
                UPDATE 
                    inventario 
                SET 
                    cantidad = cantidad + ?
                WHERE 
                    idInventario = ?`, [
                    item.cantidad,
                    inventario[0].idInventario
                ]);

                idCompraDetalle++;
            }

            // Si el tipo de compra es 1 (contado), realiza acciones adicionales
            if (idFormaPago === 'FP0001') {
                const listaSalidas = await conec.execute(connection, `
                SELECT 
                    idSalida 
                FROM 
                    salida`);
                let idSalida = generateNumericCode(1, listaSalidas, 'idSalida');

                const listaBancoDetalle = await conec.execute(connection, `
                SELECT 
                    idBancoDetalle 
                FROM 
                    bancoDetalle`);
                let idBancoDetalle = generateNumericCode(1, listaBancoDetalle, 'idBancoDetalle');

                // Inserta información en la tabla de salidas
                for (const item of metodoPago) {
                    await conec.execute(connection, `
                    INSERT INTO salida(
                        idSalida,
                        idCompra,
                        idGasto,
                        idBancoDetalle,
                        monto,
                        descripcion,
                        estado,
                        fecha,
                        hora,
                        idUsuario
                    ) VALUES(?,?,?,?,?,?,?,?,?,?)`, [
                        idSalida,
                        idCompra,
                        null,
                        idBancoDetalle,
                        item.monto,
                        item.descripcion,
                        1,
                        currentDate(),
                        currentTime(),
                        idUsuario
                    ]);

                    await conec.execute(connection, `
                    INSERT INTO bancoDetalle(
                        idBancoDetalle,
                        idBanco,
                        tipo,
                        monto,
                        estado,
                        fecha,
                        hora,
                        idUsuario
                    ) VALUES(?,?,?,?,?,?,?,?)`, [
                        idBancoDetalle,
                        item.idBanco,
                        2,
                        item.monto,
                        1,
                        currentDate(),
                        currentTime(),
                        idUsuario
                    ]);

                    idSalida++;
                    idBancoDetalle++;
                }
            }

            // Confirma la transacción
            await conec.commit(connection);
            return "create";
        } catch (error) {
            // En caso de error, realiza un rollback y devuelve un mensaje de error
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async detail(req) {
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
                al.nombre AS almacen,
                fc.nombre AS tipo,
                c.estado,
                c.observacion,
                c.nota,
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
            const detalle = await conec.query(`
            SELECT 
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
                medida AS md ON md.idMedida = p.idMedida 
            INNER JOIN 
                categoria AS m ON p.idCategoria = m.idCategoria 
            INNER JOIN 
                impuesto AS imp ON cd.idImpuesto = imp.idImpuesto  
            WHERE 
                cd.idCompra = ?`, [
                req.query.idCompra,
            ]);

            // Consulta las salidas asociadas a la compra
            const salidas = await conec.query(`
            SELECT 
                mp.nombre,
                s.descripcion,
                s.monto,
                DATE_FORMAT(s.fecha,'%d/%m/%Y') AS fecha,
                s.hora
            FROM 
                salida AS s 
            INNER JOIN 
                bancoDetalle AS bd ON bd.idBancoDetalle = s.idBancoDetalle
            INNER JOIN 
                banco as mp on mp.idBanco = bd.idBanco       
            WHERE s.idCompra = ?`, [
                req.query.idCompra
            ]);

            // Devuelve un objeto con la información de la compra, los detalles y las salidas
            return { cabecera: compra[0], detalle, salidas };
        } catch (error) {
            // Manejo de errores: Si hay un error, devuelve un mensaje de error
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async accountsPayable(req) {
        try {
            const lista = await conec.procedure(`CALL Listar_Cuenta_Pagar(?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_Cuenta_Pagar_Count(?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal
            ]);

            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }


    async cancel(req) {
        let connection = null;
        try {
            // Inicia una transacción
            connection = await conec.beginTransaction();

            // Consulta la información de la compra que se va a cancelar
            const compra = await conec.execute(connection, `
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
            if (compra.length === 0) {
                // Si no existe, realiza un rollback y devuelve un mensaje de error
                await conec.rollback(connection);
                return "La compra no existe, verifique el código o actualiza la lista.";
            }

            // Verifica si la compra ya está anulada
            if (compra[0].estado === 3) {
                // Si ya está anulada, realiza un rollback y devuelve un mensaje de error
                await conec.rollback(connection);
                return "La compra ya se encuentra anulada.";
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

            // Actualiza el estado de la salida asociada a la compra
            await conec.execute(connection, `
            UPDATE 
                salida 
            SET 
                estado = 0 
            WHERE 
                idCompra = ?`, [
                req.query.idCompra
            ]);

            const salidas = await conec.execute(connection, `
            SELECT 
                idBancoDetalle 
            FROM 
                salida 
            WHERE 
                idCompra = ?`, [
                req.query.idCompra
            ]);

            for (const item of salidas) {
                await conec.execute(connection, `
                UPDATE 
                    bancoDetalle 
                SET 
                    estado = 0 
                WHERE 
                    idBancoDetalle = ?`, [
                    item.idBancoDetalle
                ])
            }

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

            // Genera el Id del kardex
            const resultKardex = await conec.execute(connection, 'SELECT idKardex FROM kardex');
            let idKardex = 0;

            if (resultKardex.length != 0) {
                const quitarValor = resultKardex.map(item => parseInt(item.idKardex.replace("KD", '')));
                idKardex = Math.max(...quitarValor);
            }

            // Itera sobre los detalles de la compra para realizar acciones en el kardex e inventario
            for (const item of detalleCompra) {
                // Obtiene el kardex asociado
                const kardex = await conec.execute(connection, `
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
                    item.idProducto,
                ]);
                
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
                    hora,
                    fecha,
                    idUsuario
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                    `KD${String(idKardex += 1).padStart(4, '0')}`,
                    item.idProducto,
                    'TK0002',
                    'MK0004',
                    req.query.idCompra,
                    'ANULACIÓN DE LA COMPRA',
                    kardex[0].cantidad,
                    kardex[0].costo,
                    kardex[0].idAlmacen,
                    kardex[0].idInventario,
                    currentTime(),
                    currentDate(),
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
                    kardex[0].cantidad,
                    kardex[0].idInventario
                ]);
            }

            // Realiza un rollback para confirmar la operación y devuelve un mensaje de éxito
            await conec.commit(connection);
            return "cancel";
        } catch (error) {
            // Manejo de errores: Si hay un error, realiza un rollback y devuelve un mensaje de error
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }
}

module.exports = Compra;