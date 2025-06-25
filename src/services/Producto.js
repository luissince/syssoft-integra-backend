// require("@aws-sdk/client-s3");
const Conexion = require('../database/Conexion');
const {
    currentDate,
    currentTime,
    generateAlphanumericCode,
    generateNumericCode,
} = require('../tools/Tools');
const { sendSuccess, sendError, sendClient, sendSave, sendFile } = require("../tools/Message");
const FirebaseService = require('../tools/FiraseBaseService');
const { default: axios } = require("axios");
const conec = new Conexion();
const firebaseService = new FirebaseService();

class Producto {

    async list(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Productos(?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            const bucket = firebaseService.getBucket();
            const resultLista = lista.map(function (item, index) {
                if (bucket && item.imagen) {
                    return {
                        ...item,
                        imagen: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
                        // imagen: !item.imagen ? null : `${process.env.APP_URL}/files/product/${item.imagen}`,
                        id: (index + 1) + parseInt(req.query.posicionPagina)
                    }
                }

                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_Productos_Count(?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/list", error);
        }
    }

    async create(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const bucket = firebaseService.getBucket();

            const {
                idCategoria,
                idMedida,
                idMarca,
                nombre,
                codigo,
                sku,
                codigoBarras,
                idCodigoSunat,
                descripcionCorta,
                descripcionLarga,
                idTipoTratamientoProducto,
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
                imagenes,
                colores,
                tallas,
                sabores
            } = req.body;

            const validateCodigo = await conec.execute(connection, `SELECT * FROM producto WHERE codigo = ?`, [
                codigo
            ]);

            if (validateCodigo.length !== 0) {
                await conec.rollback(connection);
                return sendClient(res, "No se puede haber 2 producto con la misma clave.");
            }

            const validateNombre = await conec.execute(connection, `SELECT * FROM producto WHERE nombre = ?`, [
                nombre
            ]);

            if (validateNombre.length !== 0) {
                await conec.rollback(connection);
                return sendClient(res, "No se puede haber 2 producto con el mismo nombre.");
            }

            if (sku) {
                const validateSku = await conec.execute(connection, `SELECT * FROM producto WHERE sku = ?`, [
                    sku
                ]);

                if (validateSku.length !== 0) {
                    await conec.rollback(connection);
                    return sendClient(res, "No se puede haber 2 producto con el mismo SKU.");
                }
            }

            if (codigoBarras) {
                const validateCodigoBarras = await conec.execute(connection, `SELECT * FROM producto WHERE codigoBarras = ?`, [
                    codigoBarras
                ]);

                if (validateCodigoBarras.length !== 0) {
                    await conec.rollback(connection);
                    return sendClient(res, "No se puede haber 2 producto con el mismo código de barras.");
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
                idCodigoSunat,
                descripcionCorta,
                descripcionLarga,
                idTipoTratamientoProducto,
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
                idCodigoSunat,
                descripcionCorta,
                descripcionLarga,
                idTipoTratamientoProducto,
                costo,
                idTipoProducto,
                publicar,
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

            if (idTipoProducto === "TP0001") {
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

            /**
             * Actualizar colores, tallas, sabores
             */

            for (const color of colores) {
                await conec.execute(connection, `
                    INSERT INTO productoAtributo(
                        idProducto,
                        idAtributo,
                        fecha,
                        hora,
                        idUsuario
                    ) VALUES(?,?,?,?,?)`, [
                    idProducto,
                    color.idAtributo,
                    currentDate(),
                    currentTime(),
                    idUsuario,
                ])
            }

            for (const color of tallas) {
                await conec.execute(connection, `
                    INSERT INTO productoAtributo(
                        idProducto,
                        idAtributo,
                        fecha,
                        hora,
                        idUsuario
                    ) VALUES(?,?,?,?,?)`, [
                    idProducto,
                    color.idAtributo,
                    currentDate(),
                    currentTime(),
                    idUsuario,
                ])
            }

            for (const color of sabores) {
                await conec.execute(connection, `
                    INSERT INTO productoAtributo(
                        idProducto,
                        idAtributo,
                        fecha,
                        hora,
                        idUsuario
                    ) VALUES(?,?,?,?,?)`, [
                    idProducto,
                    color.idAtributo,
                    currentDate(),
                    currentTime(),
                    idUsuario,
                ])
            }

            await conec.commit(connection);
            return sendSave(res, "Datos registrados correctamente.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/create", error);
        }
    }

    async id(req, res) {
        try {
            const bucket = firebaseService.getBucket();

            const producto = await conec.query(`
            SELECT 
                p.idProducto,
                p.idCategoria,
                p.idMedida,
                p.idMarca,
                p.nombre,
                p.codigo,
                p.sku,
                p.codigoBarras,
                p.idCodigoSunat,
                p.descripcionCorta,
                p.descripcionLarga,
                p.idTipoTratamientoProducto,
                pc.valor AS precio,
                p.costo,
                p.idTipoProducto,
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

            let respuesta = { ...producto[0] };
            if (bucket) {
                respuesta = {
                    ...producto[0],
                    imagen: !producto[0].imagen
                        ? null
                        : {
                            nombre: producto[0].imagen,
                            url: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${producto[0].imagen}`
                        }
                };
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

            const colores = await conec.query(`
                SELECT
                    ROW_NUMBER() OVER () AS id,
                    pc.idAtributo,
                    c.nombre,
                    c.hexadecimal
                FROM 
                    productoAtributo AS pc
                INNER JOIN 
                    atributo AS c ON c.idAtributo = pc.idAtributo AND c.idTipoAtributo = 'TA0001'
                WHERE 
                    pc.idProducto = ?`, [
                req.params.idProducto
            ]);

            const tallas = await conec.query(`
                SELECT
                    ROW_NUMBER() OVER () AS id,
                    pc.idAtributo,
                    c.nombre,
                    c.valor
                FROM 
                    productoAtributo AS pc
                INNER JOIN 
                    atributo AS c ON c.idAtributo = pc.idAtributo AND c.idTipoAtributo = 'TA0002'
                WHERE 
                    pc.idProducto = ?`, [
                req.params.idProducto
            ]);

            const sabores = await conec.query(`
                SELECT
                    ROW_NUMBER() OVER () AS id,
                    pc.idAtributo,
                    c.nombre,
                    c.valor
                FROM 
                    productoAtributo AS pc
                INNER JOIN 
                    atributo AS c ON c.idAtributo = pc.idAtributo AND c.idTipoAtributo = 'TA0003'
                WHERE 
                    pc.idProducto = ?`, [
                req.params.idProducto
            ]);

            const newProducto = {
                ...respuesta,
                precios,
                detalles,
                colores,
                tallas,
                sabores,
                imagenes: newImagenes
            }

            return sendSuccess(res, newProducto);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/id", error);
        }
    }

    async update(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const bucket = firebaseService.getBucket();

            const validateCodigo = await conec.execute(connection, `SELECT * FROM producto WHERE codigo = ? AND idProducto <> ?`, [
                req.body.codigo,
                req.body.idProducto
            ]);

            if (validateCodigo.length !== 0) {
                await conec.rollback(connection);
                return sendClient(res, "No se puede haber 2 producto con la misma clave.");
            }

            const validateNombre = await conec.execute(connection, `SELECT * FROM producto WHERE nombre = ? AND idProducto <> ?`, [
                req.body.nombre,
                req.body.idProducto
            ]);

            if (validateNombre.length !== 0) {
                await conec.rollback(connection);
                return sendClient(res, "No se puede haber 2 producto con el mismo nombre.");
            }

            if (req.body.sku) {
                const validateSku = await conec.execute(connection, `SELECT * FROM producto WHERE sku = ? AND idProducto <> ?`, [
                    req.body.sku,
                    req.body.idProducto
                ]);

                if (validateSku.length !== 0) {
                    await conec.rollback(connection);
                    return sendClient(res, "No se puede haber 2 producto con el mismo SKU.");
                }
            }

            if (req.body.codigoBarras) {
                const validateCodigoBarras = await conec.execute(connection, `SELECT * FROM producto WHERE codigoBarras = ? AND idProducto <> ?`, [
                    req.body.codigoBarras,
                    req.body.idProducto
                ]);

                if (validateCodigoBarras.length !== 0) {
                    await conec.rollback(connection);
                    return sendClient(res, "No se puede haber 2 producto con el mismo código de barras.");
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
                imagen 
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
                idCodigoSunat = ?,
                descripcionCorta = ?,
                descripcionLarga = ?,
                idTipoTratamientoProducto = ?,
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
                req.body.idCodigoSunat,
                req.body.descripcionCorta,
                req.body.descripcionLarga,
                req.body.idTipoTratamientoProducto,
                req.body.costo,
                req.body.publicar,
                req.body.negativo,
                req.body.preferido,
                req.body.estado,
                imagen,
                currentDate(),
                currentTime(),
                req.body.idUsuario,
                req.body.idProducto
            ]);

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

            /**
             * Actualizar colores, tallas, sabores
             */

            await conec.execute(connection, `DELETE FROM productoAtributo WHERE idProducto = ?`, [
                req.body.idProducto
            ]);

            for (const color of req.body.colores) {
                await conec.execute(connection, `
                    INSERT INTO productoAtributo(
                        idProducto,
                        idAtributo,
                        fecha,
                        hora,
                        idUsuario
                    ) VALUES(?,?,?,?,?)`, [
                    req.body.idProducto,
                    color.idAtributo,
                    currentDate(),
                    currentTime(),
                    req.body.idUsuario,
                ])
            }

            for (const talla of req.body.tallas) {
                await conec.execute(connection, `
                    INSERT INTO productoAtributo(
                        idProducto,
                        idAtributo,
                        fecha,
                        hora,
                        idUsuario
                    ) VALUES(?,?,?,?,?)`, [
                    req.body.idProducto,
                    talla.idAtributo,
                    currentDate(),
                    currentTime(),
                    req.body.idUsuario,
                ])
            }

            for (const sabor of req.body.sabores) {
                await conec.execute(connection, `
                    INSERT INTO productoAtributo(
                        idProducto,
                        idAtributo,
                        fecha,
                        hora,
                        idUsuario
                    ) VALUES(?,?,?,?,?)`, [
                    req.body.idProducto,
                    sabor.idAtributo,
                    currentDate(),
                    currentTime(),
                    req.body.idUsuario,
                ])
            }

            await conec.commit(connection);
            return sendSave(res, "Los datos se actualizarón correctamente.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/update", error);
        }
    }

    async delete(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const bucket = firebaseService.getBucket();

            const idProducto = req.params.idProducto;

            const producto = await conec.execute(connection, `SELECT * FROM producto WHERE idProducto  = ?`, [
                idProducto
            ]);

            if (producto.length === 0) {
                await conec.rollback(connection);
                return sendClient(res, "El producto ya se encuentra eliminado.");
            }

            const inventario = await conec.execute(connection, `SELECT * FROM kardex WHERE idProducto = ?`, [
                idProducto
            ]);

            if (inventario.length !== 0) {
                await conec.rollback(connection);
                return sendClient(res, "El producto no se puede eliminar porque tiene un historial de ingresos y salidas en el kardex.");
            }

            const compra = await conec.execute(connection, `SELECT * FROM compraDetalle WHERE idProducto = ?`, [
                idProducto
            ]);

            if (compra.length !== 0) {
                await conec.rollback(connection);
                return sendClient(res, "El producto no se puede eliminar porque tiene una compra asociada.");
            }


            const venta = await conec.execute(connection, `SELECT * FROM ventaDetalle WHERE idProducto = ?`, [
                idProducto
            ]);

            if (venta.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, "No se puede eliminar el producto ya que esta ligado a una venta.");
            }

            await conec.execute(connection, `DELETE FROM inventario WHERE idProducto  = ?`, [
                idProducto
            ]);

            await conec.execute(connection, `DELETE FROM precio WHERE idProducto = ?`, [
                idProducto
            ]);

            if (producto[0].imagen) {
                if (bucket) {
                    const file = bucket.file(producto[0].imagen);
                    await file.delete();
                }
            }

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
                idProducto
            ]);

            for (const imagen of cacheImagenes) {
                if (imagen.nombre) {
                    const file = bucket.file(imagen.nombre);
                    await file.delete();
                }
            }

            await conec.execute(connection, `DELETE FROM productoImagen WHERE idProducto = ?`, [
                idProducto
            ]);

            await conec.execute(connection, `DELETE FROM productoDetalle WHERE idProducto = ?`, [
                idProducto
            ]);

            await conec.execute(connection, `DELETE FROM productoAtributo WHERE idProducto = ?`, [
                idProducto
            ]);

            await conec.execute(connection, `DELETE FROM producto WHERE idProducto  = ?`, [
                idProducto
            ]);

            await conec.commit(connection)
            return sendSave(res, "Se eliminó correctamente el producto.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/delete", error);
        }
    }

    async detalle(req, res) {

    }

    async combo(req, res) {
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
            return sendSuccess(res, result);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/combo", error);
        }
    }

    async filter(req, res) {
        try {
            const result = await conec.query(`
            SELECT 
                p.idProducto,
                p.imagen,
                p.codigo,
                p.sku,
                p.codigoBarras,
                p.nombre,
                p.costo,
                pc.valor AS precio,
                c.nombre AS categoria,
                tp.nombre as tipoProducto,
                p.idTipoTratamientoProducto,
                p.idTipoProducto,
                p.idMedida,
                me.nombre AS unidad
            FROM 
                producto AS p
            INNER JOIN 
                medida AS me ON me.idMedida = p.idMedida
            INNER JOIN 
                categoria AS c ON c.idCategoria = p.idCategoria
            INNER JOIN 
                tipoProducto AS tp ON tp.idTipoProducto = p.idTipoProducto
            INNER JOIN 
                precio AS pc ON pc.idProducto = p.idProducto AND pc.preferido = 1
            WHERE 
                p.estado = 1 AND (
                    (p.codigo LIKE CONCAT('%',?,'%'))
                    OR
                    (p.sku = ?)
                    OR
                    (p.codigoBarras = ?)
                    OR 
                    (p.nombre LIKE CONCAT('%',?,'%'))
                )`, [
                req.query.filtrar,
                req.query.filtrar,
                req.query.filtrar,
                req.query.filtrar,
            ]);

            const bucket = firebaseService.getBucket();
            const newData = result.map(item => {
                if (bucket && item.imagen) {
                    return {
                        ...item,
                        imagen: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
                    }
                }
                return item;
            });

            return sendSuccess(res, newData);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/filter", error);
        }
    }

    async filterAlmacen(req, res) {
        try {
            const result = await conec.query(`
            SELECT 
                p.idProducto,
                p.imagen,
                p.codigo,
                p.sku,
                p.codigoBarras,
                p.nombre,
                a.nombre as almacen,
                inv.cantidad,
                p.costo,
                pc.valor AS precio,
                c.nombre AS categoria,
                tp.nombre as tipoProducto,
                me.nombre AS unidad,
                p.idTipoTratamientoProducto,
                p.idTipoProducto,
                p.idMedida,
                me.nombre AS unidad
            FROM 
                producto AS p
            INNER JOIN 
                medida AS me ON me.idMedida = p.idMedida
            INNER JOIN 
                categoria AS c ON c.idCategoria = p.idCategoria
            INNER JOIN 
                tipoProducto AS tp ON tp.idTipoProducto = p.idTipoProducto
            INNER JOIN 
                precio AS pc ON pc.idProducto = p.idProducto AND pc.preferido = 1
            INNER JOIN 
                inventario AS inv ON inv.idProducto = p.idProducto  AND inv.idAlmacen = ?     
            INNER JOIN
                almacen AS a ON a.idAlmacen = inv.idAlmacen    
            WHERE 
                p.estado = 1 AND (
                    (p.codigo LIKE CONCAT('%',?,'%'))
                    OR
                    (p.sku = ?)
                    OR
                    (p.codigoBarras = ?)
                    OR 
                    (p.nombre LIKE CONCAT('%',?,'%'))
                )`, [
                req.query.idAlmacen,
                req.query.filtrar,
                req.query.filtrar,
                req.query.filtrar,
                req.query.filtrar,
            ]);

            const bucket = firebaseService.getBucket();
            const newData = result.map(item => {
                if (bucket && item.imagen) {
                    return {
                        ...item,
                        imagen: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
                    }
                }
                return item;
            });

            return sendSuccess(res, newData);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/filterAlmacen", error);
        }
    }

    async filtrarParaVenta(req, res) {
        try {
            const bucket = firebaseService.getBucket();

            const result = await conec.procedure("CALL Filtrar_Productos_Para_Venta(?,?,?,?,?,?)", [
                parseInt(req.query.tipo),
                req.query.filtrar,
                req.query.idSucursal,
                req.query.idAlmacen,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina),
            ]);

            const resultLista = result.map(function (item, index) {
                if (bucket) {
                    return {
                        ...item,
                        // imagen: !item.imagen ? null : `${process.env.APP_URL}/files/product/${item.imagen}`,
                        imagen: !item.imagen ? null : `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
                        id: (index + 1) + parseInt(req.query.posicionPagina)
                    }
                }
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Filtrar_Productos_Para_Venta_Count(?,?,?,?)`, [
                parseInt(req.query.tipo),
                req.query.filtrar,
                req.query.idSucursal,
                req.query.idAlmacen,
            ]);

            return sendSuccess(res, { "lists": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/filtrarParaVenta", error);
        }
    }

    async preferidos(req, res) {
        try {
            const bucket = firebaseService.getBucket();

            const result = await conec.procedure("CALL Listar_Productos_Preferidos(?,?)", [
                req.query.idSucursal,
                req.query.idAlmacen
            ])

            const resultLista = result.map(function (item) {
                if (bucket) {
                    return {
                        ...item,
                        imagen: !item.imagen ? null : `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
                        // imagen: !item.imagen ? null : `${process.env.APP_URL}/files/product/${item.imagen}`,
                    }
                }
                return {
                    ...item,
                }
            });

            return sendSuccess(res, resultLista);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/preferidos", error);
        }
    }

    async preferidoEstablecer(req, res) {
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
            return sendSave(res, "Se estableció como preferido el producto.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/preferidoEstablecer", error);
        }
    }

    async obtenerListPrecio(req, res) {
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

            return sendSuccess(res, lista);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/obtenerListPrecio", error);
        }
    }

    async rangePriceWeb(req, res) {
        try {
            const data = await conec.query(`
            SELECT 
                IFNULL(MIN(valor), 0) AS minimo,
                IFNULL(MAX(valor), 0) AS maximo
            FROM 
                precio`, [
                req.query.idProducto
            ]);
            return sendSuccess(res, {
                "minimo": data[0].minimo,
                "maximo": data[0].maximo,
            });
        } catch (error) {
            console.log(error)
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/rangePriceWeb", error);
        }
    }

    async filterWeb(req, res) {
        try {
            const { buscar, filtros, posicionPagina, filasPorPagina } = req.body;

            const categoriasCSV = filtros?.categories?.map(item => item.id).join(',') || '';
            const marcasCSV = filtros?.brands?.map(item => item.id).join(',') || '';
            const coloresCSV = filtros?.colors?.map(item => item.id).join(',') || '';
            const tallasCSV = filtros?.sizes?.map(item => item.id).join(',') || '';
            const saboresCSV = filtros?.flavors?.map(item => item.id).join(',') || '';
            const precioMin = filtros && filtros.priceRange ? Number(filtros.priceRange[0]) : 0;
            const precioMax = filtros && filtros.priceRange ? Number(filtros.priceRange[1]) : 999999;

            const bucket = firebaseService.getBucket();

            const [sucursal] = await conec.query(`
            SELECT 
                idSucursal
            FROM 
                sucursal 
            WHERE 
                principal = 1`);
                
            const lista = await conec.procedure(`CALL Listar_Productos_Web(?,?,?,?,?,?,?,?,?,?)`, [
                buscar,
                categoriasCSV,
                marcasCSV,
                coloresCSV,
                tallasCSV,
                saboresCSV,
                precioMin,
                precioMax,
                parseInt(posicionPagina),
                parseInt(filasPorPagina)
            ]);

            const data = await Promise.all(lista.map(async (item, index) => {
                const [inventario] = await conec.query(`
                  SELECT 
                      inv.cantidad
                  FROM 
                      almacen AS alm 
                  INNER JOIN 
                      inventario AS inv ON inv.idAlmacen = alm.idAlmacen
                  WHERE 
                      alm.predefinido = 1 AND alm.idSucursal = ? AND inv.idProducto = ?`, [
                  sucursal.idSucursal,
                  item.idProducto
                ]);
              
                return {
                  ...item,
                  imagen: bucket && item.imagen
                    ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`
                    : null,
                  id: (index + 1) + parseInt(posicionPagina),
                  cantidad: inventario?.cantidad || 0,
                };
              }));


            const rows = await conec.procedure(`CALL Listar_Productos_Web_Count(?,?,?,?,?,?,?,?)`, [
                buscar,
                categoriasCSV,
                marcasCSV,
                coloresCSV,
                tallasCSV,
                saboresCSV,
                precioMin,
                precioMax,
            ]);

            return sendSuccess(res, { data, count: rows[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/filterWeb", error);
        }
    }

    async filterWebLimit(req, res) {
        try {
            const limit = req.params.limit;

            const bucket = firebaseService.getBucket();

            const list = await conec.procedure(`CALL Listar_Productos_Web_Index(?)`, [parseInt(limit)]);
            const newList = list.map(function (item, index) {
                if (bucket) {
                    return {
                        ...item,
                        id: index + 1,
                        imagen: !item.imagen ? null : `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
                    }
                }
                return {
                    ...item,
                    id: index + 1,
                }
            });
            return sendSuccess(res, newList);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/filterWebIndex", error);
        }
    }

    async filterWebId(req, res) {
        try {
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
                CASE 
                    WHEN p.idTipoProducto = 'TP0001' THEN i.cantidad
                    ELSE 0
                END AS cantidad,
                 CASE 
                    WHEN p.idTipoProducto = 'TP0001' THEN 0
                    ELSE 1
                END AS servicio,

                c.idCategoria,
                c.nombre AS categoriaNombre,

                m.idMarca,
                m.nombre AS marcaNombre
            FROM 
                producto AS p
            INNER JOIN 
                precio AS pc ON pc.idProducto = p.idProducto AND pc.preferido = 1
            INNER JOIN 
                categoria AS c ON c.idCategoria = p.idCategoria
            LEFT JOIN 
                marca AS m ON m.idMarca = p.idMarca
            LEFT JOIN 
                inventario AS i ON i.idProducto = p.idProducto 
            LEFT JOIN 
                almacen AS a ON a.idAlmacen = i.idAlmacen
            WHERE 
                p.codigo = ?
                AND
                (
                    p.idTipoProducto = 'TP0001' AND a.idSucursal = ?
                    OR
                    p.idTipoProducto = 'TP0002'
                )
                `, [
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

            const colores = await conec.query(`
                SELECT
                    ROW_NUMBER() OVER () AS id,
                    pc.idAtributo,
                    c.nombre,
                    c.hexadecimal
                FROM 
                    productoAtributo AS pc
                INNER JOIN 
                    atributo AS c ON c.idAtributo = pc.idAtributo AND c.idTipoAtributo = 'TA0001'
                WHERE 
                    pc.idProducto = ?`, [
                producto[0].idProducto
            ]);

            const tallas = await conec.query(`
                SELECT
                    ROW_NUMBER() OVER () AS id,
                    pc.idAtributo,
                    c.nombre,
                    c.valor
                FROM 
                    productoAtributo AS pc
                INNER JOIN 
                    atributo AS c ON c.idAtributo = pc.idAtributo AND c.idTipoAtributo = 'TA0002'
                WHERE 
                    pc.idProducto = ?`, [
                producto[0].idProducto
            ]);

            const sabores = await conec.query(`
                SELECT
                    ROW_NUMBER() OVER () AS id,
                    pc.idAtributo,
                    c.nombre,
                    c.valor
                FROM 
                    productoAtributo AS pc
                INNER JOIN 
                    atributo AS c ON c.idAtributo = pc.idAtributo AND c.idTipoAtributo = 'TA0003'
                WHERE 
                    pc.idProducto = ?`, [
                producto[0].idProducto
            ]);

            const respuesta = {
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
                detalles: detalles,
                imagenes: newImagenes,
                colores,
                tallas,
                sabores,
            };

            // delete respuesta.categoriaNombre;
            // delete respuesta.marcaNombre;

            // const r2 = new S3Client({
            //     region: 'auto',
            //     endpoint: process.env.CLOUDFLARE_ACCOUNT_ID,
            //     credentials: {
            //         accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
            //         secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
            //     }
            // });

            // const url = await getSignedUrl(r2,
            //     new GetObjectCommand({
            //         Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
            //         Key: image.nombre
            //     }),
            //     { expiresIn: 3600 }
            // );

            return sendSuccess(res, respuesta);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/filterWebPages", error);
        }
    }

    async filterWebRelatedId(req, res) {
        try {
            const bucket = firebaseService.getBucket();

            const list = await conec.query(`
            SELECT 
                p.idProducto,
                p.codigo,
                p.sku,
                p.codigoBarras,
                p.nombre,
                p.descripcionCorta,
                pc.valor AS precio,
                p.imagen,

                c.idCategoria,
                c.nombre AS nombreCategoria
            FROM 
                producto AS p 
            INNER JOIN 
                precio AS pc ON p.idProducto = pc.idProducto AND pc.preferido = 1
            INNER JOIN 
                categoria AS c ON p.idCategoria = c.idCategoria    
            WHERE
                p.publicar = 1 AND p.idProducto <> ? AND p.idCategoria = ? 
            ORDER BY 
                p.fecha DESC, p.hora DESC
            LIMIT 4`, [
                req.query.idProducto,
                req.query.idCategoria
            ])

            const resultLista = list.map(function (item, index) {
                if (bucket && item.imagen) {
                    return {
                        ...item,
                        id: index + 1,
                        imagen: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
                    }
                }
                return {
                    ...item,
                    id: index + 1,
                }
            });

            return sendSuccess(res, resultLista);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/filterWebPages", error);
        }
    }

    // async filterWebRelatedProduct(req, res) {
    //     try {
    //         const lista = await conec.query(`
    //         SELECT 
    //             p.idProducto,
    //             p.codigo,
    //             p.nombre,
    //             pc.valor AS precio,
    //             p.imagen,
    //             c.nombre AS categoria
    //         FROM 
    //             producto AS p 
    //         INNER JOIN 
    //             precio AS pc ON p.idProducto = pc.idProducto AND pc.preferido = 1
    //         INNER JOIN 
    //             categoria AS c ON p.idCategoria = c.idCategoria    
    //         WHERE
    //             c.idCategoria = ? 
    //         ORDER BY 
    //             p.fecha DESC, p.hora DESC
    //         LIMIT 

    //             posicionPagina, filasPorPagina`, [
    //             req.query.idCategoria
    //         ]);

    //         const resultLista = lista.map(function (item, index) {
    //             return {
    //                 ...item,
    //                 imagen: !item.imagen ? null : `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
    //                 id: (index + 1) + parseInt(req.query.posicionPagina)
    //             }
    //         });

    //         return sendSuccess(res, resultLista);
    //     } catch (error) {
    //         return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/filterWebPages", error);
    //     }
    // }

    async documentsPdfReports(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/product/pdf/reports`,
                headers: {
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/documentsPdfReports", error);
        }
    }

    async documentsPdfExcel(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/product/excel`,
                headers: {
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/documentsPdfExcel", error);
        }
    }

    async documentsPdfCodBar(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/product/pdf/codbar`,
                headers: {
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/documentsPdfExcel", error);
        }
    }

}

module.exports = Producto;