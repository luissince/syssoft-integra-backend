const path = require("path");
const Conexion = require('../database/Conexion');
const {
    currentDate,
    currentTime,
    generateAlphanumericCode,
    isDirectory,
    processImage,
    mkdir,
    chmod,
    generateNumericCode,
} = require('../tools/Tools');
const logger = require('../tools/Logger');
const conec = new Conexion();

require('dotenv').config();

class Producto {

    async list(req) {
        try {
            console.log(req.query)
            const lista = await conec.procedure(`CALL Listar_Productos(?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    imagen: !item.imagen ? null : `${process.env.APP_URL}/files/product/${item.imagen}`,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_Productos_Count(?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar
            ]);
            return { "result": resultLista, "total": total[0].Total }
        } catch (error) {
            console.log(error)
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async add(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const {
                idCategoria,
                idMedida,
                nombre,
                codigo,
                idCodigoSunat,
                descripcion,
                idTipoTratamientoProducto,
                costo,
                precio,
                tipo,
                publicar,
                inventariado,
                negativo,
                preferido,
                estado,
                idUsuario,

                inventarios,
                precios
            } = req.body;

            const validateCodigo = await conec.execute(connection, `SELECT * FROM producto WHERE codigo = ?`, [
                codigo
            ]);

            if (validateCodigo.length !== 0) {
                await conec.rollback(connection);
                return "No se puede haber 2 producto con la misma clave.";
            }

            const validateNombre = await conec.execute(connection, `SELECT * FROM producto WHERE nombre = ?`, [
                nombre
            ]);

            if (validateNombre.length !== 0) {
                await conec.rollback(connection);
                return "No se puede haber 2 producto con el mismo nombre.";
            }

            const fileDirectory = path.join(__dirname, '..', 'path', 'product');
            const exists = await isDirectory(fileDirectory);

            if (!exists) {
                await mkdir(fileDirectory);
                await chmod(fileDirectory);
            }

            const imagen = await processImage(fileDirectory, req.body.image, req.body.ext, null);

            const resultProducto = await conec.execute(connection, 'SELECT idProducto FROM producto');
            const idProducto = generateAlphanumericCode("PD0001", resultProducto, 'idProducto');

            await conec.execute(connection, `
            INSERT INTO producto(
                idProducto,
                idCategoria,
                idMedida,
                nombre,
                codigo,
                idCodigoSunat,
                descripcion,
                idTipoTratamientoProducto,
                costo,
                idTipoProducto,
                publicar,
                inventariado,
                negativo,
                preferido,
                estado,
                imagen,
                fecha,
                hora,
                fupdate,
                hupdate,
                idUsuario
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idProducto,
                idCategoria,
                idMedida,
                nombre,
                codigo,
                idCodigoSunat,
                descripcion,
                idTipoTratamientoProducto,
                costo,
                tipo,
                publicar,
                inventariado,
                negativo,
                preferido,
                estado,
                imagen,
                currentDate(),
                currentTime(),
                currentDate(),
                currentTime(),
                idUsuario,
            ])

            if (tipo === "TP0001") {
                /**
                 * Generar id del inventario
                 */
                const listaInventarios = await conec.execute(connection, 'SELECT idInventario FROM inventario');
                let idInventario = generateNumericCode(1, listaInventarios, 'idInventario');

                /**
                 * Generar id del kardex
                 */
                const resultKardex = await conec.execute(connection, 'SELECT idKardex FROM kardex');
                let idKardex = 0;

                if (resultKardex.length != 0) {
                    const quitarValor = resultKardex.map(item => parseInt(item.idKardex.replace("KD", '')));
                    idKardex = Math.max(...quitarValor);
                }

                /**
                 * Registrar los almacenes
                 */
                const almacenes = await conec.execute(connection, `SELECT idAlmacen FROM almacen`);

                for (const almacen of almacenes) {
                    const inventario = inventarios.find(inventario => almacen.idAlmacen === inventario.idAlmacen);

                    if (inventario) {
                        await conec.execute(connection, `
                        INSERT INTO inventario(
                            idInventario,
                            idProducto,
                            idAlmacen,
                            cantidad,
                            cantidadMaxima,
                            cantidadMinima
                        ) VALUES(?,?,?,?,?,?)`, [
                            idInventario,
                            idProducto,
                            inventario.idAlmacen,
                            inventario.cantidad,
                            inventario.cantidadMaxima,
                            inventario.cantidadMinima,
                        ]);

                        const resultInventarioInicial = await conec.execute(connection, 'SELECT idInventarioInicial FROM inventarioInicial');
                        const idInventarioInicial = generateAlphanumericCode("IN0001", resultInventarioInicial, 'idInventarioInicial');

                        await conec.execute(connection, `
                        INSERT INTO inventarioInicial(
                            idInventarioInicial,
                            observacion,
                            estado,
                            fecha,
                            hora,
                            idUsuario
                        ) VALUES(?,?,?,?,?,?)`, [
                            idInventarioInicial,
                            `El inventario inicial del producto ${nombre} se ha registrado correctamente con una cantidad de ${inventario.cantidad}.`,
                            1,
                            currentDate(),
                            currentTime(),
                            idUsuario
                        ])

                        await conec.execute(connection, `
                        INSERT INTO kardex(
                            idKardex,
                            idProducto,
                            idTipoKardex,
                            idMotivoKardex,
                            idInventarioInicial,
                            detalle,
                            cantidad,
                            costo,
                            idAlmacen,
                            idInventario,
                            fecha,
                            hora,                            
                            idUsuario
                        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                            `KD${String(idKardex += 1).padStart(4, '0')}`,
                            idProducto,
                            'TK0001',
                            'MK0001',
                            idInventarioInicial,
                            'INGRESO AL CREAR EL PRODUCTO',
                            inventario.cantidad,
                            costo,
                            inventario.idAlmacen,
                            idInventario,
                            currentDate(),
                            currentTime(),
                            idUsuario
                        ]);

                        idInventario++;
                    } else {
                        await conec.execute(connection, `
                        INSERT INTO inventario(
                            idInventario,
                            idProducto,
                            idAlmacen,
                            cantidad,
                            cantidadMaxima,
                            cantidadMinima
                        ) VALUES(?,?,?,?,?,?)`, [
                            idInventario,
                            idProducto,
                            almacen.idAlmacen,
                            0,
                            0,
                            0,
                        ]);

                        idInventario++;
                    }
                }
            }

            /**
             * Registrar precio
             */
            let idPrecio = 1;

            await conec.execute(connection, `
            INSERT INTO precio(
                idPrecio,
                idProducto,
                nombre,
                valor,
                preferido
            ) VALUES(?,?,?,?,?)`, [
                idPrecio,
                idProducto,
                "Precio Normal",
                precio,
                1
            ])

            for (const precio of precios) {
                idPrecio++;

                await conec.execute(connection, `
                INSERT INTO precio(
                    idPrecio,
                    idProducto,
                    nombre,
                    valor,
                    preferido
                ) VALUES(?,?,?,?,?)`, [
                    idPrecio,
                    idProducto,
                    precio.nombre,
                    precio.precio,
                    0
                ])
            }

            await conec.commit(connection);
            return "insert";
        } catch (error) {
            logger.error(`Producto/add: ${error.message ?? error}`)
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async id(req) {
        try {
            const producto = await conec.query(`
            SELECT 
                p.idProducto,
                p.idCategoria,
                p.idMedida,
                p.nombre,
                p.codigo,
                p.idCodigoSunat,
                p.descripcion,
                p.idTipoTratamientoProducto,
                pc.valor AS precio,
                p.costo,
                p.idTipoProducto,
                p.publicar,
                p.inventariado,
                p.negativo,
                p.preferido,
                p.imagen,
                p.estado
            FROM 
                producto AS p
            INNER JOIN 
                precio AS pc ON pc.idProducto = p.idProducto AND pc.preferido = 1
            WHERE 
                p.idProducto = ?`, [
                req.query.idProducto
            ]);

            const respuesta = {
                ...producto[0],
                imagen: !producto[0].imagen ? null : `${process.env.APP_URL}/files/product/${producto[0].imagen}`,
            };

            const precios = await conec.query(`
            SELECT
                ROW_NUMBER() OVER () AS id,
                nombre,
                valor AS precio
            FROM 
                precio 
            WHERE 
                idProducto = ? AND preferido <> 1`, [
                req.query.idProducto
            ]);

            const newProducto = {
                ...respuesta,
                precios
            }

            return newProducto
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async update(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const validateCodigo = await conec.execute(connection, `
            SELECT 
                1 
            FROM 
                producto 
            WHERE 
                codigo = ? AND idProducto <> ?`, [
                req.body.codigo,
                req.body.idProducto
            ]);

            if (validateCodigo.length !== 0) {
                await conec.rollback(connection);
                return "No se puede haber 2 producto con la misma clave.";
            }

            const validateNombre = await conec.execute(connection, `
            SELECT 
                * 
            FROM 
                producto 
            WHERE 
                nombre = ? AND idProducto <> ?`, [
                req.body.nombre,
                req.body.idProducto
            ]);

            if (validateNombre.length !== 0) {
                await conec.rollback(connection);
                return "No se puede haber 2 producto con el mismo nombre.";
            }

            const fileDirectory = path.join(__dirname, '..', 'path', 'product');
            const exists = await isDirectory(fileDirectory);

            if (!exists) {
                await mkdir(fileDirectory);
                await chmod(fileDirectory);
            }

            const producto = await await conec.execute(connection, `
            SELECT 
                imagen 
            FROM 
                producto 
            WHERE 
                idProducto = ?`, [
                req.body.idProducto
            ])

            const imagen = await processImage(fileDirectory, req.body.image, req.body.ext, producto[0].imagen);

            await conec.execute(connection, `
            UPDATE 
                producto 
            SET
                idCategoria = ?,
                idMedida = ?,     
                nombre = ?,
                codigo = ?,
                idCodigoSunat = ?,
                descripcion = ?,
                idTipoTratamientoProducto = ?,
                costo = ?,
                publicar = ?,
                inventariado = ?,
                negativo = ?,
                preferido = ?,
                estado = ?,
                imagen = ?,
                fupdate = ?,
                hupdate = ?,
                idUsuario = ?
            WHERE 
                idProducto = ?`, [
                req.body.idCategoria,
                req.body.idMedida,
                req.body.nombre,
                req.body.codigo,
                req.body.idCodigoSunat,
                req.body.descripcion,
                req.body.idTipoTratamientoProducto,
                req.body.costo,
                req.body.publicar,
                req.body.inventariado,
                req.body.negativo,
                req.body.preferido,
                req.body.estado,
                imagen,
                currentDate(),
                currentTime(),
                req.body.idUsuario,
                req.body.idProducto
            ]);


            await conec.execute(connection, `DELETE FROM precio WHERE idProducto = ?`, [
                req.body.idProducto
            ])

            /**
             * Registrar precio
             */
            let idPrecio = 1;

            await conec.execute(connection, `
            INSERT INTO precio(
                idPrecio,
                idProducto,
                nombre,
                valor,
                preferido
            ) VALUES(?,?,?,?,?)`, [
                idPrecio,
                req.body.idProducto,
                "Precio Normal",
                req.body.precio,
                1
            ])

            for (const precio of req.body.precios) {
                idPrecio++;

                await conec.execute(connection, `
                INSERT INTO precio(
                    idPrecio,
                    idProducto,
                    nombre,
                    valor,
                    preferido
                ) VALUES(?,?,?,?,?)`, [
                    idPrecio,
                    req.body.idProducto,
                    precio.nombre,
                    precio.precio,
                    0
                ])
            }

            await conec.commit(connection);
            return "update";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async delete(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const { idProducto } = req.query;

            const producto = await conec.execute(connection, `SELECT * FROM producto WHERE idProducto  = ?`, [
                idProducto
            ]);

            if (producto.length === 0) {
                await conec.rollback(connection);
                return "El producto ya se encuentra eliminado.";
            }

            const inventario = await conec.execute(connection, `SELECT * FROM kardex WHERE idProducto = ?`, [
                idProducto
            ])

            if (inventario.length !== 0) {
                await conec.rollback(connection);
                return "El producto no se puede eliminar porque tiene un historial de ingresos y salidas en el kardex.";
            }

            const venta = await conec.execute(connection, `SELECT * FROM ventaDetalle WHERE idProducto = ?`, [
                idProducto
            ])

            if (venta.length > 0) {
                await conec.rollback(connection);
                return "No se puede eliminar el producto ya que esta ligado a una venta.";
            }

            await conec.execute(connection, `DELETE FROM inventario WHERE idProducto  = ?`, [
                idProducto
            ])

            await conec.execute(connection, `DELETE FROM precio WHERE idProducto = ?`, [
                idProducto
            ])

            await conec.execute(connection, `DELETE FROM producto WHERE idProducto  = ?`, [
                idProducto
            ])

            await conec.commit(connection)
            return "delete";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async detalle(req) {

    }

    async combo(req) {
        try {
            const result = await conec.query(`
            SELECT 
                p.idProducto,
                p.idTipoProducto,
                p.nombre,
                p.costo,
                m.nombre as medida 
            FROM 
                producto AS p
            INNER JOIN 
                medida as m ON m.idMedida = p.idMedida
            WHERE 
                p.idTipoProducto <> 'TP0003'`);
            return result
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async filter(req) {
        try {
            const result = await conec.query(`
            SELECT 
                p.idProducto,
                p.nombre,
                p.costo,
                pc.valor AS precio,
                c.nombre AS categoria,
                tp.nombre as tipoProducto,
                p.idTipoTratamientoProducto,
                p.idMedida
            FROM 
                producto AS p
            INNER JOIN 
                categoria AS c ON c.idCategoria = p.idCategoria
            INNER JOIN 
                tipoProducto AS tp ON tp.idTipoProducto = p.idTipoProducto
            INNER JOIN 
                precio AS pc ON pc.idProducto = p.idProducto AND pc.preferido = 1
            WHERE 
                (p.codigo LIKE CONCAT(?,'%')) 
                OR 
                (p.nombre LIKE CONCAT(?,'%'))`, [
                req.query.filtrar,
                req.query.filtrar,
            ])
            return result;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async filterAlmacen(req) {
        try {
            const result = await conec.query(`
            SELECT 
                p.idProducto,
                p.nombre,
                inv.cantidad,
                p.costo,
                c.nombre AS categoria,
                tp.nombre as tipoProducto,
                me.nombre AS unidad
            FROM 
                producto AS p
            INNER JOIN 
                categoria AS c ON c.idCategoria = p.idCategoria
            INNER JOIN 
                tipoProducto AS tp ON tp.idTipoProducto = p.idTipoProducto
            INNER JOIN 
                medida AS me ON me.idMedida = p.idMedida
            INNER JOIN 
                inventario AS inv ON inv.idProducto = p.idProducto  AND inv.idAlmacen = ?          
            WHERE 
                (p.codigo LIKE CONCAT(?,'%'))
                OR 
                (p.nombre LIKE CONCAT(?,'%'))`, [
                req.query.idAlmacen,
                req.query.filtrar,
                req.query.filtrar,
            ])
            return result;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async filtrarParaVenta(req) {
        try {
            const result = await conec.procedure("CALL Filtrar_Productos_Para_Venta(?,?,?,?,?,?)", [
                parseInt(req.query.tipo),
                req.query.filtrar,
                req.query.idSucursal,
                req.query.idAlmacen,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina),
            ]);

            const resultLista = result.map(function (item, index) {
                return {
                    ...item,
                    imagen: !item.imagen ? null : `${process.env.APP_URL}/files/product/${item.imagen}`,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Filtrar_Productos_Para_Venta_Count(?,?,?,?)`, [
                parseInt(req.query.tipo),
                req.query.filtrar,
                req.query.idSucursal,
                req.query.idAlmacen,
            ]);

            return { "lists": resultLista, "total": total[0].Total }
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async preferidos(req) {
        try {
            const result = await conec.procedure("CALL Listar_Productos_Preferidos(?,?)", [
                req.query.idSucursal,
                req.query.idAlmacen
            ])

            const resultLista = result.map(function (item) {
                return {
                    ...item,
                    imagen: !item.imagen ? null : `${process.env.APP_URL}/files/product/${item.imagen}`,
                }
            });

            return resultLista
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async preferidoEstablecer(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            await conec.execute(connection, `
            UPDATE 
                producto 
            SET 
                preferido = ? 
            WHERE 
                idProducto = ?`, [
                req.body.preferido,
                req.body.idProducto
            ]);

            await conec.commit(connection);
            return "update";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async obtenerListPrecio(req) {
        try {
            const lista = await conec.query(`
            SELECT 
                nombre, 
                valor 
            FROM 
                precio 
            WHERE 
                idProducto = ?`, [
                req.query.idProducto
            ]);

            return lista;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

}

module.exports = Producto;