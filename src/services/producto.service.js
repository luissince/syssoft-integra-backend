const conec = require('../database/mysql-connection');
const {
    currentDate,
    currentTime,
    generateAlphanumericCode
} = require('../tools/Tools');
const firebaseService = require('../common/fire-base');
const { default: axios } = require("axios");
const { KARDEX_TYPES, KARDEX_MOTIVOS } = require('../config/constants');
const { ClientError } = require('../tools/Error');

class ProductoService {

    async list(req) {
        const lista = await conec.procedure(`CALL Listar_Productos(?,?,?,?)`, [
            parseInt(req.query.opcion),
            req.query.buscar,
            parseInt(req.query.posicionPagina),
            parseInt(req.query.filasPorPagina)
        ]);

        const bucket = firebaseService.getBucket();
        const resultLista = lista.map((item, index) => ({
            ...item,
            imagen: bucket && item.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : null,
            id: (index + 1) + parseInt(req.query.posicionPagina)
        }));

        const total = await conec.procedure(`CALL Listar_Productos_Count(?,?)`, [
            parseInt(req.query.opcion),
            req.query.buscar
        ]);

        return { "result": resultLista, "total": total[0].Total };
    }

    async create(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const date = currentDate();
            const time = currentTime();

            const bucket = firebaseService.getBucket();

            const {
                idCategoria,
                idMedida,
                idMarca,
                nombre,
                codigo,
                sku,
                codigoBarras,
                descripcionCorta,
                descripcionLarga,
                idTipoTratamientoProducto,
                idMetodoDepreciacion,
                costo,
                precio,
                idTipoProducto,
                publicar,
                negativo,
                preferido,
                estado,
                idUsuario,

                inventarios,
                precios,
                detalles,
                imagenes
            } = req.body;

            const validateCodigo = await conec.execute(connection, `SELECT * FROM producto WHERE codigo = ? AND estado <> -1`, [
                codigo
            ]);

            if (validateCodigo.length !== 0) {
                throw new ClientError("No se puede haber 2 producto con la misma clave.");
            }

            const validateNombre = await conec.execute(connection, `SELECT * FROM producto WHERE nombre = ? AND estado <> -1`, [
                nombre
            ]);

            if (validateNombre.length !== 0) {
                throw new ClientError("No se puede haber 2 producto con el mismo nombre.");
            }

            if (sku) {
                const validateSku = await conec.execute(connection, `SELECT * FROM producto WHERE sku = ? AND estado <> -1`, [
                    sku
                ]);

                if (validateSku.length !== 0) {
                    throw new ClientError("No se puede haber 2 producto con el mismo SKU.");
                }
            }

            if (codigoBarras) {
                const validateCodigoBarras = await conec.execute(connection, `SELECT * FROM producto WHERE codigoBarras = ? AND estado <> -1`, [
                    codigoBarras
                ]);

                if (validateCodigoBarras.length !== 0) {
                    throw new ClientError("No se puede haber 2 producto con el mismo código de barras.");
                }
            }

            // const fileDirectory = path.join(__dirname, '..', 'path', 'product');
            // const exists = await isDirectory(fileDirectory);

            // if (!exists) {
            //     await mkdir(fileDirectory);
            //     await chmod(fileDirectory);
            // }

            // const imagen = await processImage(fileDirectory, req.body.image, req.body.ext, null);

            let imagen = null;

            if (req.body.imagen && req.body.imagen.base64 !== undefined) {
                if (bucket) {
                    const buffer = Buffer.from(req.body.imagen.base64, 'base64');

                    const timestamp = Date.now();
                    const uniqueId = Math.random().toString(36).substring(2, 9);
                    const fileName = `product_${timestamp}_${uniqueId}.${req.body.imagen.extension}`;

                    const file = bucket.file(fileName);
                    await file.save(buffer, {
                        metadata: {
                            contentType: 'image/' + req.body.imagen.extension,
                        }
                    });
                    await file.makePublic();

                    imagen = fileName;
                }
            }

            const resultProducto = await conec.execute(connection, 'SELECT idProducto FROM producto');
            const idProducto = generateAlphanumericCode("PD0001", resultProducto, 'idProducto');

            await conec.execute(connection, `
            INSERT INTO producto(
                idProducto,
                idCategoria,
                idMedida,
                idMarca,
                nombre,
                codigo,
                sku,
                codigoBarras,
                descripcionCorta,
                descripcionLarga,
                idTipoTratamientoProducto,
                idMetodoDepreciacion,
                costo,
                idTipoProducto,
                publicar,
                negativo,
                preferido,
                estado,
                imagen,
                fecha,
                hora,
                fupdate,
                hupdate,
                idUsuario
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idProducto,
                idCategoria,
                idMedida,
                idMarca,
                nombre,
                codigo,
                sku,
                codigoBarras,
                descripcionCorta,
                descripcionLarga,
                idTipoTratamientoProducto,
                idMetodoDepreciacion,
                costo,
                idTipoProducto,
                publicar,
                negativo,
                preferido,
                estado,
                imagen,
                date,
                time,
                date,
                time,
                idUsuario,
            ])

            if (["TP0001", "TP0004", "TP0005", "TP0006"].includes(idTipoProducto)) {
                const almacenes = await conec.execute(connection, `SELECT idAlmacen FROM almacen`);

                for (const almacen of almacenes) {
                    await conec.execute(connection, `
                        INSERT INTO inventario(
                            idProducto,
                            idAlmacen
                        ) VALUES(?,?)`, [
                        idProducto,
                        almacen.idAlmacen
                    ]);
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
                    precio.nombre.trim(),
                    precio.precio,
                    0
                ])
            }

            /**
             * Registrar detalles
             */
            let idDetalle = 1;

            for (const detalle of detalles) {
                idDetalle++;

                await conec.execute(connection, `
                INSERT INTO productoDetalle(
                    idDetalle,
                    idProducto,
                    nombre,
                    valor
                ) VALUES(?,?,?,?)`, [
                    idDetalle,
                    idProducto,
                    detalle.nombre.trim(),
                    detalle.valor.trim()
                ])
            }

            /**
             * Registrar imagenes
             */

            let idImagen = 0;

            for (const imagen of imagenes) {
                if (imagen.base64 !== undefined) {
                    const buffer = Buffer.from(imagen.base64, 'base64');

                    const timestamp = Date.now();
                    const uniqueId = Math.random().toString(36).substring(2, 9);
                    const fileName = `product_${req.body.codigo}_${timestamp}_${uniqueId}.${imagen.extension}`;

                    const file = bucket.file(fileName);
                    await file.save(buffer, {
                        metadata: {
                            contentType: 'image/' + imagen.extension,
                        }
                    });
                    await file.makePublic();

                    idImagen++;

                    await conec.execute(connection, `
                    INSERT INTO productoImagen(
                        idImagen,
                        idProducto,
                        nombre,
                        extension,
                        ancho,
                        alto
                    ) VALUES(?,?,?,?,?,?)`, [
                        idImagen,
                        idProducto,
                        fileName,
                        imagen.extension,
                        imagen.width,
                        imagen.height,
                    ]);
                }
            }

            await conec.commit(connection);
            return "Datos registrados correctamente.";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }

            throw error;
        }
    }

    async id(req) {
        const bucket = firebaseService.getBucket();

        const producto = await conec.query(`
        SELECT 
            p.idProducto,
            p.idTipoProducto,
            p.idCategoria,
            p.idMedida,
            p.idMarca,
            p.nombre,
            p.codigo,
            p.sku,
            p.codigoBarras,
            p.descripcionCorta,
            p.descripcionLarga,
            p.idTipoTratamientoProducto,
            p.idMetodoDepreciacion,
            pc.valor AS precio,
            p.costo,
            p.publicar,
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
            req.params.idProducto
        ]);

        const respuesta = {
            ...producto[0],
            imagen: bucket && producto[0].imagen ? {
                nombre: producto[0].imagen,
                url: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${producto[0].imagen}`
            } : null,
        }

        const precios = await conec.query(`
        SELECT
            ROW_NUMBER() OVER () AS id,
            nombre,
            valor AS precio
        FROM 
            precio 
        WHERE 
            idProducto = ? AND preferido <> 1`, [
            req.params.idProducto
        ]);

        const imagenes = await conec.query(`
        SELECT
            idImagen,
            idProducto,
            nombre,
            ancho,
            alto
        FROM 
            productoImagen 
        WHERE 
            idProducto = ?`, [
            req.params.idProducto
        ]);

        const newImagenes = [];
        let countImage = 0;

        if (bucket) {
            for (const image of imagenes) {
                newImagenes.push({
                    "index": countImage,
                    "idImagen": image.idImagen,
                    "idProducto": image.idProducto,
                    "nombre": image.nombre,
                    "url": `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${image.nombre}`,
                    "remover": false
                });

                countImage++;
            }
        }

        const detalles = await conec.query(`
        SELECT
            ROW_NUMBER() OVER () AS id,
            nombre,
            valor
        FROM 
            productoDetalle 
        WHERE 
            idProducto = ?`, [
            req.params.idProducto
        ]);

        return {
            ...respuesta,
            precios,
            detalles,
            imagenes: newImagenes
        }
    }

    async update(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const date = currentDate();
            const time = currentTime();

            const bucket = firebaseService.getBucket();

            const validateCodigo = await conec.execute(connection, `SELECT * FROM producto WHERE codigo = ? AND idProducto <> ? AND estado <> -1`, [
                req.body.codigo,
                req.body.idProducto
            ]);

            if (validateCodigo.length !== 0) {
                throw new ClientError("No se puede haber 2 producto con la misma clave.");
            }

            const validateNombre = await conec.execute(connection, `SELECT * FROM producto WHERE nombre = ? AND idProducto <> ? AND estado <> -1`, [
                req.body.nombre,
                req.body.idProducto
            ]);

            if (validateNombre.length !== 0) {
                throw new ClientError("No se puede haber 2 producto con el mismo nombre.");
            }

            if (req.body.sku) {
                const validateSku = await conec.execute(connection, `SELECT * FROM producto WHERE sku = ? AND idProducto <> ? AND estado <> -1`, [
                    req.body.sku,
                    req.body.idProducto
                ]);

                if (validateSku.length !== 0) {
                    throw new ClientError("No se puede haber 2 producto con el mismo SKU.");
                }
            }

            if (req.body.codigoBarras) {
                const validateCodigoBarras = await conec.execute(connection, `SELECT * FROM producto WHERE codigoBarras = ? AND idProducto <> ? AND estado <> -1`, [
                    req.body.codigoBarras,
                    req.body.idProducto
                ]);

                if (validateCodigoBarras.length !== 0) {
                    throw new ClientError("No se puede haber 2 producto con el mismo código de barras.");
                }
            }

            // const fileDirectory = path.join(__dirname, '..', 'path', 'product');
            // const exists = await isDirectory(fileDirectory);

            // if (!exists) {
            //     await mkdir(fileDirectory);
            //     await chmod(fileDirectory);
            // }

            // const imagen = await processImage(fileDirectory, req.body.image, req.body.ext, producto[0].imagen);

            const producto = await await conec.execute(connection, `
            SELECT 
                imagen,
                idTipoProducto
            FROM 
                producto 
            WHERE 
                idProducto = ?`, [
                req.body.idProducto
            ]);


            let imagen = null;

            if (req.body.imagen && req.body.imagen.nombre === undefined && req.body.imagen.base64 === undefined) {
                if (bucket) {
                    if (producto[0].imagen) {
                        const file = bucket.file(producto[0].imagen);
                        await file.delete();
                    }
                }

            } else if (req.body.imagen && req.body.imagen.base64 !== undefined) {
                if (bucket) {
                    if (producto[0].imagen) {
                        const file = bucket.file(producto[0].imagen);
                        if (file.exists()) {
                            await file.delete();
                        }
                    }

                    const buffer = Buffer.from(req.body.imagen.base64, 'base64');

                    const timestamp = Date.now();
                    const uniqueId = Math.random().toString(36).substring(2, 9);
                    const fileName = `product_${timestamp}_${uniqueId}.${req.body.imagen.extension}`;

                    const file = bucket.file(fileName);
                    await file.save(buffer, {
                        metadata: {
                            contentType: 'image/' + req.body.imagen.extension,
                        }
                    });
                    await file.makePublic();
                    imagen = fileName;
                }
            } else {
                imagen = req.body.imagen.nombre;
            }

            await conec.execute(connection, `
            UPDATE 
                producto 
            SET
                idCategoria = ?,
                idMedida = ?,     
                idMarca = ?,
                nombre = ?,
                codigo = ?,
                sku = ?,
                codigoBarras = ?,
                descripcionCorta = ?,
                descripcionLarga = ?,
                idTipoTratamientoProducto = ?,
                idMetodoDepreciacion = ?,
                costo = ?,
                publicar = ?,
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
                req.body.idMarca,
                req.body.nombre,
                req.body.codigo,
                req.body.sku,
                req.body.codigoBarras,
                req.body.descripcionCorta,
                req.body.descripcionLarga,
                req.body.idTipoTratamientoProducto,
                req.body.idMetodoDepreciacion,
                req.body.costo,
                req.body.publicar,
                req.body.negativo,
                req.body.preferido,
                req.body.estado,
                imagen,
                date,
                time,
                req.body.idUsuario,
                req.body.idProducto
            ]);

            /**
             * Actualizar inventario en caso no exista
             */

            if (["TP0001", "TP0004", "TP0005", "TP0006"].includes(producto[0].idTipoProducto)) {
                const inventario = await conec.execute(connection, `SELECT * FROM inventario WHERE idProducto = ?`, [
                    req.body.idProducto
                ]);

                if (inventario.length === 0) {
                    const almacenes = await conec.execute(connection, `SELECT idAlmacen FROM almacen`);

                    for (const almacen of almacenes) {
                        await conec.execute(connection, `
                        INSERT INTO inventario(
                            idProducto,
                            idAlmacen
                        ) VALUES(?,?)`, [
                            req.body.idProducto,
                            almacen.idAlmacen
                        ]);
                    }
                }

            }

            /**
             * Actualizar precio
             */

            await conec.execute(connection, `DELETE FROM precio WHERE idProducto = ?`, [
                req.body.idProducto
            ]);

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
            ]);

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
                    precio.nombre.trim(),
                    precio.precio,
                    0
                ])
            }

            /**
             * Actualizar detalles
             */
            await conec.execute(connection, `DELETE FROM productoDetalle WHERE idProducto = ?`, [
                req.body.idProducto
            ]);

            let idDetalle = 0;

            for (const detalle of req.body.detalles) {
                idDetalle++;

                await conec.execute(connection, `
                INSERT INTO productoDetalle(
                    idDetalle,
                    idProducto,
                    nombre,
                    valor
                ) VALUES(?,?,?,?)`, [
                    idDetalle,
                    req.body.idProducto,
                    detalle.nombre.trim(),
                    detalle.valor.trim()
                ])
            }

            /**
             * Actualizar imagenes
             */
            const cacheImagenes = await conec.execute(connection, `
                SELECT 
                    idImagen,
                    idProducto,
                    nombre,
                    extension,
                    ancho,
                    alto
                FROM
                    productoImagen
                WHERE
                    idProducto = ?`, [
                req.body.idProducto
            ]);

            await conec.execute(connection, `DELETE FROM productoImagen WHERE idProducto = ?`, [
                req.body.idProducto
            ]);

            let idImagen = 0;

            for (const imagen of req.body.imagenes) {
                if (imagen.remover !== undefined && imagen.remover === true) {
                    const file = bucket.file(imagen.nombre);
                    await file.delete();
                } else if (imagen.base64 !== undefined) {
                    const buffer = Buffer.from(imagen.base64, 'base64');

                    const timestamp = Date.now();
                    const uniqueId = Math.random().toString(36).substring(2, 9);
                    const fileName = `product_${req.body.codigo}_${timestamp}_${uniqueId}.${imagen.extension}`;

                    const file = bucket.file(fileName);
                    await file.save(buffer, {
                        metadata: {
                            contentType: 'image/' + imagen.extension,
                        }
                    });
                    await file.makePublic();

                    idImagen++;

                    await conec.execute(connection, `
                    INSERT INTO productoImagen(
                        idImagen,
                        idProducto,
                        nombre,
                        extension,
                        ancho,
                        alto
                    ) VALUES(?,?,?,?,?,?)`, [
                        idImagen,
                        req.body.idProducto,
                        fileName,
                        imagen.extension,
                        imagen.width,
                        imagen.height,
                    ]);
                } else {
                    const imageOld = cacheImagenes.find((item) => item.idImagen === imagen.idImagen && item.idProducto == imagen.idProducto);

                    idImagen++;
                    await conec.execute(connection, `
                    INSERT INTO productoImagen(
                        idImagen,
                        idProducto,
                        nombre,
                        extension,
                        ancho,
                        alto
                    ) VALUES(?,?,?,?,?,?)`, [
                        idImagen,
                        imageOld.idProducto,
                        imageOld.nombre,
                        imageOld.extension,
                        imageOld.ancho,
                        imageOld.alto,
                    ]);
                }
            }

            await conec.commit(connection);
            return "Los datos se actualizarón correctamente.";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }

            throw error;
        }
    }

    async remove(req) {
        let connection = null;
        try {
            const { idProducto, idUsuario } = req.query;

            const date = currentDate();
            const time = currentTime();

            connection = await conec.beginTransaction();

            await conec.execute(connection, `
                UPDATE 
                    producto 
                SET 
                    estado = -1 
                WHERE 
                    idProducto = ?`, [
                idProducto
            ]);

            await conec.execute(connection, `    
                INSERT INTO auditoria(
                    idReferencia,
                    idUsuario,
                    tipo,
                    descripción
                ) VALUES(?,?,?,?)`, [
                idProducto,
                idUsuario,
                'ELIMINAR',
                'ELIMINACIÓN DEL PRODUCTO',
                date,
                time,
            ]);

            await conec.commit(connection)
            return "Se eliminó correctamente el producto.";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }

            throw error;
        }
    }

    async detalle(req) {

    }

    async combo() {
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
                p.idTipoProducto <> 'TP0003' AND p.estado = 1`);
        return result;
    }

    async filter(req) {
        const result = await conec.procedure(`CALL Filtrar_Productos(?)`, [
            req.query.filtrar,
        ]);

        const bucket = firebaseService.getBucket();
        const newData = result.map(item => ({
            ...item,
            imagen: bucket && item.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : null,
        }));

        return newData;
    }

    async filterAlmacen(req) {
        const { idAlmacen, filtrar } = req.query;

        const result = await conec.procedure(`CALL Filtrar_Productos_Por_Almacen(?, ?)`, [
            idAlmacen,
            filtrar
        ]);

        const bucket = firebaseService.getBucket();

        const productos = result.map(item => ({
            ...item,
            imagen: bucket && item.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : null,
        }));

        if (productos.length === 0) return productos;

        const nuevosProductos = await Promise.all(productos.map(async (item) => {
            const inventarioDetalles = await conec.procedure("CALL Filtrar_Productos_Por_Almacen_Inventario_Detalle(?,?)", [
                item.idProducto,
                idAlmacen,
            ]);

            item.inventarioDetalles = inventarioDetalles;
            return item;
        })
        );

        return nuevosProductos;
    }

    async filtrarParaVenta(req) {
        const { tipo, filtrar, idAlmacen, posicionPagina, filasPorPagina } = req.query;

        const bucket = firebaseService.getBucket();

        const result = await conec.procedure("CALL Filtrar_Productos_Para_Venta(?,?,?,?,?)", [
            parseInt(tipo),
            filtrar,
            idAlmacen,
            parseInt(posicionPagina),
            parseInt(filasPorPagina),
        ]);

        const resultLista = await Promise.all(result.map(async (item, index) => {
            const inventarioDetalles = await conec.procedure("CALL Filtrar_Productos_Para_Venta_Inventario_Detalle(?,?)", [
                item.idProducto,
                idAlmacen,
            ]);

            console.log(item.idProducto);
            console.log(idAlmacen);
            console.log(inventarioDetalles);

            const newProducto = {
                ...item,
                imagen: bucket && item.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : null,
                inventarioDetalles: inventarioDetalles,
                id: (index + 1) + parseInt(posicionPagina)
            };

            return newProducto;
        }));

        const total = await conec.procedure(`CALL Filtrar_Productos_Para_Venta_Count(?,?,?)`, [
            parseInt(tipo),
            filtrar,
            idAlmacen,
        ]);

        return { "list": resultLista, "total": total[0].Total };
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

            return "Se estableció como preferido el producto.";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }

            throw error;
        }
    }

    async obtenerListPrecio(req) {
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
    }

    async filterWebAll() {
        const bucket = firebaseService.getBucket();

        const [sucursal] = await conec.query(`
        SELECT 
            idSucursal
        FROM 
            sucursal 
        WHERE 
            principal = 1`);

        const list = await conec.procedure(`CALL Listar_Productos_Web_All()`);

        const data = await Promise.all(list.map(async (item, index) => {
            const [inventario] = await conec.query(`
            SELECT 
                IFNULL(
                    SUM(
                        CASE 
                            WHEN k.idTipoKardex = 'TK0001' THEN k.cantidad
                            ELSE -k.cantidad
                        END
                    ),0
                ) AS cantidad
            FROM 
                producto AS p 
            LEFT JOIN 
                kardex AS k ON p.idProducto = k.idProducto
            LEFT JOIN
                almacen AS a ON a.idAlmacen = k.idAlmacen
            WHERE 
                a.idSucursal = ? AND a.predefinido = 1 AND p.idProducto = ?
            GROUP BY
                p.idProducto`, [
                sucursal.idSucursal,
                item.idProducto
            ]);

            return {
                ...item,
                imagen: bucket && item.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : null,
                id: (index + 1),
                cantidad: inventario?.cantidad || 0,
            };
        }));

        return data;
    }

    async filterWebId(req) {
        const bucket = firebaseService.getBucket();

        const [sucursal] = await conec.query(`
        SELECT 
            idSucursal
        FROM 
            sucursal 
        WHERE 
            principal = 1`);

        const producto = await conec.query(`
        SELECT 
            p.idProducto,
            p.nombre,
            p.codigo,
            p.sku,
            p.codigoBarras,
            p.descripcionCorta,
            p.descripcionLarga,
            pc.valor AS precio,
            p.imagen,            
            IFNULL(
                SUM(
                    CASE 
                        WHEN k.idTipoKardex = 'TK0001' THEN k.cantidad
                        ELSE -k.cantidad
                    END
                ),0
            ) AS cantidad,
            p.idTipoProducto,

            c.idCategoria,
            c.nombre AS categoriaNombre,

            m.idMarca,
            m.nombre AS marcaNombre,

            me.idMedida,
            me.nombre AS nombreMedida
        FROM 
            producto AS p
        INNER JOIN 
            precio AS pc ON pc.idProducto = p.idProducto AND pc.preferido = 1
        INNER JOIN 
            categoria AS c ON c.idCategoria = p.idCategoria
        INNER JOIN  
            medida AS me ON p.idMedida = me.idMedida
        LEFT JOIN 
            marca AS m ON m.idMarca = p.idMarca
        LEFT JOIN 
            kardex AS k ON p.idProducto = k.idProducto
        LEFT JOIN
            almacen AS a ON a.idAlmacen = k.idAlmacen
        WHERE 
            p.estado = 1 AND p.idProducto = ? OR p.codigo = ? AND a.idSucursal = ? AND a.predefinido = 1
        GROUP BY
            p.idProducto`, [
            req.query.codigo,
            req.query.codigo,
            sucursal.idSucursal,
        ]);

        const detalles = await conec.query(`
        SELECT
            ROW_NUMBER() OVER () AS id,
            nombre,
            valor
        FROM 
            productoDetalle 
        WHERE 
            idProducto = ?`, [
            producto[0].idProducto
        ]);

        const imagenes = await conec.query(`
        SELECT
            ROW_NUMBER() OVER () AS id,
            nombre,
            ancho,
            alto
        FROM 
            productoImagen 
        WHERE 
            idProducto = ?`, [
            producto[0].idProducto
        ]);

        const newImagenes = [];

        if (bucket) {
            for (const image of imagenes) {
                newImagenes.push({
                    "idImagen": image.id,
                    "nombre": image.nombre,
                    "url": `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${image.nombre}`,
                    "ancho": image.ancho,
                    "alto": image.alto,
                });
            }
        }

        return {
            ...producto[0],
            imagen: !producto[0].imagen ? null : `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${producto[0].imagen}`,
            categoria: {
                idCategoria: producto[0].idCategoria,
                nombre: producto[0].categoriaNombre,
            },
            marca: {
                idMarca: producto[0].idMarca,
                nombre: producto[0].marcaNombre,
            },
            medida: {
                idMedida: producto[0].idMedida,
                nombre: producto[0].nombreMedida,
            },
            detalles: detalles,
            imagenes: newImagenes,
        };
    }

    async filterWebRelatedId(req) {
        const bucket = firebaseService.getBucket();

        const [sucursal] = await conec.query(`
        SELECT 
            idSucursal
        FROM 
            sucursal 
        WHERE 
            principal = 1`);

        const productosRelacionados = await conec.query(`
        SELECT 
            p.idProducto,
            p.nombre,
            p.codigo,
            p.sku,
            p.codigoBarras,
            p.descripcionCorta,
            p.descripcionLarga,
            pc.valor AS precio,
            p.imagen,
            IFNULL(
                SUM(
                    CASE 
                        WHEN k.idTipoKardex = 'TK0001' THEN k.cantidad
                        ELSE -k.cantidad
                    END
                ),0
            ) AS cantidad,
             CASE 
                WHEN p.idTipoProducto = 'TP0001' THEN 0
                ELSE 1
            END AS servicio,

            c.idCategoria,
            c.nombre AS categoriaNombre,

            m.idMarca,
            m.nombre AS marcaNombre,

            me.idMedida,
            me.nombre AS nombreMedida
        FROM 
            producto AS p
        INNER JOIN 
            precio AS pc ON pc.idProducto = p.idProducto AND pc.preferido = 1
        INNER JOIN 
            categoria AS c ON c.idCategoria = p.idCategoria
        INNER JOIN  
            medida AS me ON p.idMedida = me.idMedida
        INNER JOIN 
            marca AS m ON m.idMarca = p.idMarca
        INNER JOIN 
            kardex AS k ON p.idProducto = k.idProducto
        INNER JOIN
            almacen AS a ON a.idAlmacen = k.idAlmacen
        WHERE
            p.estado = 1 AND p.publicar = 1 AND p.idProducto <> ? AND p.idCategoria = ? AND a.idSucursal = ? AND a.predefinido = 1
        GROUP BY
            p.idProducto
        ORDER BY 
            p.fecha DESC, p.hora DESC
        LIMIT 4`, [
            req.query.idProducto,
            req.query.idCategoria,
            sucursal.idSucursal,
        ]);

        console.log("productosRelacionados");
        console.log(req.query.idProducto, req.query.idCategoria, sucursal.idSucursal);

        console.log(productosRelacionados);

        const resultLista = productosRelacionados.map(function (item) {
            return {
                ...item,
                imagen: !item.imagen ? null : `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
                categoria: {
                    idCategoria: item.idCategoria,
                    nombre: item.categoriaNombre,
                },
                marca: {
                    idMarca: item.idMarca,
                    nombre: item.marcaNombre,
                },
                medida: {
                    idMedida: item.idMedida,
                    nombre: item.nombreMedida,
                },
            }
        });

        return resultLista;
    }

    async documentsPdfReports() {
        const options = {
            method: 'POST',
            url: `${process.env.APP_PDF}/product/pdf/reports`,
            headers: {
                'Content-Type': 'application/json',
            },
            responseType: 'arraybuffer'
        };

        const response = await axios.request(options);
        return response;
    }

    async documentsPdfExcel() {
        const options = {
            method: 'POST',
            url: `${process.env.APP_PDF}/product/excel`,
            headers: {
                'Content-Type': 'application/json',
            },
            responseType: 'arraybuffer'
        };

        const response = await axios.request(options);
        return response;
    }

    async documentsPdfCodBar() {
        const options = {
            method: 'POST',
            url: `${process.env.APP_PDF}/product/pdf/codbar`,
            headers: {
                'Content-Type': 'application/json',
            },
            responseType: 'arraybuffer'
        };

        const response = await axios.request(options);
        return response;
    }

    async dashboard(req) {
        const result = await conec.procedureAll(`CALL Dashboard_Producto(?,?,?,?)`, [
            req.body.fechaInicio,
            req.body.fechaFinal,
            req.body.idSucursal,
            req.body.idAlmacen
        ]);

        const bucket = firebaseService.getBucket();

        return {
            // Productos Vendidos con Detalles de Costo y Ganancia
            "productosVendidos": {
                data: result[0].map((item) => {
                    if (bucket && item.imagen) {
                        return {
                            ...item,
                            imagen: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
                        }
                    }
                    return item;
                }) ?? [],
                descripcion: "Productos Vendidos con Detalles de Costo y Ganancia"
            },
            // Productos Más Vendidos (Top 3)
            "productosMasVendidos": {
                data: result[1],
                descripcion: "Productos Más Vendidos (Top 3)"
            },
            // Estado de Inventario para Productos con Movimiento
            "estadoInventario": {
                data: result[2][0],
                descripcion: "Estado de Inventario para Productos con Movimiento"
            },
            // Rendimiento por Categoría con Análisis de Margen
            "rendimientoCategoria": {
                data: result[3],
                descripcion: "Rendimiento por Categoría con Análisis de Margen"
            },
            // Productos con Bajo Inventario que Requieren Reorden
            "productosConBajoInventario": {
                data: result[4].map((item) => {
                    if (bucket && item.imagen) {
                        return {
                            ...item,
                            imagen: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
                        }
                    }
                    return item;
                }) ?? [],
                descripcion: "Productos con Bajo Inventario que Requieren Reorden"
            },
            // Productos sin Ventas Hoy pero con Inventario Disponible
            "productosSinVentaConInventario": {
                data: result[5].map((item) => {
                    if (bucket && item.imagen) {
                        return {
                            ...item,
                            imagen: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
                        }
                    }
                    return item;
                }) ?? [],
                descripcion: "Productos sin Ventas Hoy pero con Inventario Disponible"
            },
        };
    }

    async updateInventario() {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const inventarios = await conec.execute(connection, `SELECT * FROM inventario`);

            for (const inventario of inventarios) {
                await conec.execute(connection, `
                INSERT INTO inventarioDetalle(
                    idInventario,
                    cantidad,
                    porDefecto,
                    fecha,
                    hora,
                    idUsuario
                ) VALUES(?,?,?,?,?,?)`, [
                    inventario.idInventario,
                    inventario.cantidad || 0,
                    true,
                    currentDate(),
                    currentTime(),
                    "US0001"
                ]);
            }

            await conec.commit(connection);
            return "Datos registrados correctamente.";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }

            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }
}

module.exports = new ProductoService();