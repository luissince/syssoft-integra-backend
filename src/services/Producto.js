const conec = require('../database/mysql-connection');
const {
    currentDate,
    currentTime,
    generateAlphanumericCode,
    generateFileData,
    toNullString,
    toNullNumber,
    processFirebaseFile,
} = require('../tools/Tools');
const { sendSuccess, sendError, sendSave, sendFile } = require("../tools/Message");
const firebaseService = require('../common/fire-base');
const redisService = require('../common/redis');
const { PRODUCT_FILTER_WEB, PRODUCT_FILTER_WEB_ID, PRODUCT_FILTER_WEB_RELATED_ID } = require('../common/constants/redis.constants');
const { default: axios } = require("axios");
const { ClientError } = require('../tools/Error');

class Producto {

    async list(req, res) {
        try {
            const { opcion, idTipoProducto, estado, preferido, publicarTienda, buscar, posicionPagina, filasPorPagina } = req.query;

            const lista = await conec.procedure(`CALL Listar_Productos(?,?,?,?,?,?,?,?)`, [
                parseInt(opcion),
                toNullString(idTipoProducto),
                toNullNumber(estado),
                toNullNumber(preferido),
                toNullNumber(publicarTienda),
                toNullString(buscar),
                parseInt(posicionPagina),
                parseInt(filasPorPagina)
            ]);

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    imagen: firebaseService.getUrl(item.imagen),
                    id: (index + 1) + parseInt(posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_Productos_Count(?,?,?,?,?,?)`, [
                parseInt(opcion),
                toNullString(idTipoProducto),
                toNullNumber(estado),
                toNullNumber(preferido),
                toNullNumber(publicarTienda),
                toNullString(buscar),
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

            const date = currentDate();
            const time = currentTime();

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

                precios,
                detalles,
                imagenes,
                colores,
                tallas,
                sabores,
                atributos,
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

            const [empresa] = await conec.query(`
            SELECT
                idEmpresa,
                documento,
                razonSocial,
                nombreEmpresa,
                rutaLogo,
                rutaImage,
                usuarioSolSunat,
                claveSolSunat
            FROM 
                empresa 
            LIMIT 
                1`);

            if (!empresa) {
                throw new Error("No se encontró la empresa.");
            }

            let imagen = null;

            if (req.body.imagen && req.body.imagen.base64 !== undefined) {
                const { buffer, filePath } = generateFileData(req.body.imagen.base64, req.body.imagen.extension, empresa.documento, "product");

                const file = await firebaseService.uploadFile(filePath, buffer, 'image/' + req.body.imagen.extension);

                if (file) {
                    imagen = filePath;
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
                date,
                time,
                date,
                time,
                idUsuario,
            ]);

            if (!["TP0002"].includes(idTipoProducto)) {
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

                    const { buffer, filePath } = generateFileData(imagen.base64, imagen.extension, empresa.documento, "product");

                    await firebaseService.uploadFile(filePath, buffer, 'image/' + imagen.extension);

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
                        filePath,
                        imagen.extension,
                        imagen.width,
                        imagen.height,
                    ]);
                }
            }

            /**
             * Actualizar atributos
             */

            for (const atributo of req.body.atributos) {
                await conec.execute(connection, `
                INSERT INTO productoAtributo(
                    idProducto,
                    idAtributo,
                    fecha,
                    hora,
                    idUsuario
                ) VALUES(?,?,?,?,?)`, [
                    idProducto,
                    atributo.idAtributo,
                    date,
                    time,
                    idUsuario,
                ]);
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
            const { idProducto } = req.params;

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
                idProducto
            ]);

            if (producto[0].length === 0) {
                throw new Error("El producto no existe, verifique el código o actualiza la lista.");
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
                idProducto
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
                idProducto
            ]);

            const newImagenes = [];
            let countImage = 0;

            for (const image of imagenes) {
                newImagenes.push({
                    "index": countImage,
                    "idImagen": image.idImagen,
                    "idProducto": image.idProducto,
                    "nombre": image.nombre,
                    "url": firebaseService.getUrl(image.nombre),
                    "remover": false
                });

                countImage++;
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
                idProducto
            ]);

            const atributos = await conec.query(`
            SELECT
                a.idAtributo,
                a.idTipoAtributo,
                a.nombre,
                a.hexadecimal,
                a.valor
            FROM 
                atributo AS a
            INNER JOIN 
                productoAtributo AS pa ON pa.idAtributo = a.idAtributo
            WHERE
                pa.idProducto = ?
            ORDER BY
                a.idTipoAtributo,
                a.nombre`, [
                idProducto
            ]);

            const imagen = firebaseService.getUrl(producto[0].imagen);

            const newProducto = {
                ...producto[0],
                imagen: imagen ? {
                    nombre: producto[0].imagen,
                    url: imagen,
                } : null,
                precios,
                detalles,
                atributos: atributos,
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

            const date = currentDate();
            const time = currentTime();

            const validateCodigo = await conec.execute(connection, `SELECT * FROM producto WHERE codigo = ? AND idProducto <> ? AND estado <> -1`, [
                req.body.codigo,
                req.body.idProducto
            ]);

            if (validateCodigo.length !== 0) {
                throw new Error("No se puede haber 2 producto con la misma clave.");

            }

            const validateNombre = await conec.execute(connection, `SELECT * FROM producto WHERE nombre = ? AND idProducto <> ? AND estado <> -1`, [
                req.body.nombre,
                req.body.idProducto
            ]);

            if (validateNombre.length !== 0) {
                throw new Error("No se puede haber 2 producto con el mismo nombre.");
            }

            if (req.body.sku) {
                const validateSku = await conec.execute(connection, `SELECT * FROM producto WHERE sku = ? AND idProducto <> ? AND estado <> -1`, [
                    req.body.sku,
                    req.body.idProducto
                ]);

                if (validateSku.length !== 0) {
                    throw new Error("No se puede haber 2 producto con el mismo SKU.");
                }
            }

            if (req.body.codigoBarras) {
                const validateCodigoBarras = await conec.execute(connection, `SELECT * FROM producto WHERE codigoBarras = ? AND idProducto <> ? AND estado <> -1`, [
                    req.body.codigoBarras,
                    req.body.idProducto
                ]);

                if (validateCodigoBarras.length !== 0) {
                    throw new Error("No se puede haber 2 producto con el mismo código de barras.");
                }
            }

            const [empresa] = await conec.query(`
            SELECT
                idEmpresa,
                documento,
                razonSocial,
                nombreEmpresa,
                rutaLogo,
                rutaImage,
                usuarioSolSunat,
                claveSolSunat
            FROM 
                empresa 
            LIMIT 
                1`);

            if (!empresa) {
                throw new Error("No se encontró la empresa.");
            }

            const producto = await await conec.execute(connection, `
            SELECT 
                idTipoProducto,
                imagen 
            FROM 
                producto 
            WHERE 
                idProducto = ?`, [
                req.body.idProducto
            ]);

            const imagen = await processFirebaseFile(
                firebaseService,
                req.body.imagen,
                producto[0].rutaLogo,
                empresa.documento,
                "product"
            );

            let idTipoProducto = producto[0].idTipoProducto;

            if (producto[0].idTipoProducto !== req.body.idTipoProducto) {
                const movimientos = await conec.execute(connection, `
                SELECT 'compraDetalle' AS origen
                FROM compraDetalle
                WHERE idProducto = ?

                UNION ALL

                SELECT 'ventaDetalle'
                FROM ventaDetalle
                WHERE idProducto = ?

                UNION ALL

                SELECT 'ajusteDetalle'
                FROM ajusteDetalle
                WHERE idProducto = ?

                UNION ALL

                SELECT 'trasladoDetalle'
                FROM trasladoDetalle
                WHERE idProducto = ?

                UNION ALL

                SELECT 'kardex'
                FROM kardex
                WHERE idProducto = ?

                LIMIT 1`, [
                    req.body.idProducto,
                    req.body.idProducto,
                    req.body.idProducto,
                    req.body.idProducto,
                    req.body.idProducto
                ]);

                if (movimientos.length > 0) {
                    throw new Error(
                        `No se puede cambiar el tipo de producto porque tiene movimientos en ${movimientos[0].origen}`
                    );
                }

                idTipoProducto = req.body.idTipoProducto;
            }

            await conec.execute(connection, `
            UPDATE 
                producto 
            SET
                idTipoProducto = ?,
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
                idTipoProducto,
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
                date,
                time,
                req.body.idUsuario,
                req.body.idProducto
            ]);

            /**
             * Actualizar inventario en caso no exista
             */

            if (!["TP0002"].includes(producto[0].idTipoProducto)) {
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
                    await firebaseService.deleteFile(imagen.nombre);
                } else if (imagen.base64 !== undefined) {

                    const { buffer, filePath } = generateFileData(imagen.base64, imagen.extension, empresa.documento, "product");

                    await firebaseService.uploadFile(filePath, buffer, 'image/' + req.body.imagen.extension);

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
                        filePath,
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
             * Actualizar atributos
             */

            await conec.execute(connection, `DELETE FROM productoAtributo WHERE idProducto = ?`, [
                req.body.idProducto
            ]);

            for (const atributo of req.body.atributos) {
                await conec.execute(connection, `
                INSERT INTO productoAtributo(
                    idProducto,
                    idAtributo,
                    fecha,
                    hora,
                    idUsuario
                ) VALUES(?,?,?,?,?)`, [
                    req.body.idProducto,
                    atributo.idAtributo,
                    date,
                    time,
                    req.body.idUsuario,
                ]);
            }

            // Invalidar caché del producto
            const cacheKey = PRODUCT_FILTER_WEB_ID(req.body.idProducto)


            await redisService.delete(cacheKey);

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
            const { idProducto, idUsuario } = req.query;

            const date = currentDate();
            const time = currentTime();

            connection = await conec.beginTransaction();

            // Validar que el producto exista
            const producto = await conec.execute(connection, `
            SELECT 
                imagen
            FROM 
                producto 
            WHERE 
                idProducto = ?`, [
                idProducto
            ]);

            if (producto.length === 0) {
                throw new Error("El producto no existe, verifique el código o actualiza la lista.");
            }

            const kardexs = await conec.execute(connection, `
            SELECT 
                * 
            FROM                 
                kardex AS k
            WHERE 
                k.idProducto = ? `, [
                idProducto
            ]);

            if (kardexs.length === 0) {
                await conec.execute(connection, `DELETE FROM inventario WHERE idProducto = ?`, [
                    idProducto
                ]);

                await conec.execute(connection, `DELETE FROM precio WHERE idProducto = ?`, [
                    idProducto
                ]);

                await conec.execute(connection, `DELETE FROM productoDetalle WHERE idProducto = ?`, [
                    idProducto
                ]);

                await conec.execute(connection, `DELETE FROM productoAtributo WHERE idProducto = ?`, [
                    idProducto
                ]);

                await conec.execute(connection, `DELETE FROM producto WHERE idProducto = ?`, [
                    idProducto
                ]);

                const productoImagenes = await conec.execute(connection, `
                SELECT 
                    nombre
                FROM 
                    productoImagen 
                WHERE 
                    idProducto = ?`, [
                    idProducto
                ]);

                await conec.execute(connection, `DELETE FROM productoImagen WHERE idProducto = ?`, [
                    idProducto
                ]);

                await firebaseService.deleteFile(producto[0].imagen);

                for (const productoImagen of productoImagenes) {
                    await firebaseService.deleteFile(productoImagen.nombre);
                }


            } else {
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
            }

            await conec.commit(connection);

            // Invalidar caché del producto
            const cacheKey = PRODUCT_FILTER_WEB_ID(req.body.idProducto)

            await redisService.delete(cacheKey);

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
                p.idTipoProducto <> 'TP0003' AND p.estado = 1`);
            return sendSuccess(res, result);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/combo", error);
        }
    }

    async filter(req, res) {
        try {
            const result = await conec.procedure(`CALL Filtrar_Productos(?)`, [
                req.query.filtrar,
            ]);

            const newData = result.map(item => {
                return {
                    ...item,
                    imagen: firebaseService.getUrl(item.imagen),
                };
            });

            return sendSuccess(res, newData);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/filter", error);
        }
    }

    async filterAlmacen(req, res) {
        try {
            const result = await conec.procedure(`CALL Filtrar_Productos_Por_Almacen(?,?)`, [
                req.query.idAlmacen,
                req.query.filtrar
            ]);

            const newData = result.map(item => {
                return {
                    ...item,
                    imagen: firebaseService.getUrl(item.imagen),
                };
            });

            return sendSuccess(res, newData);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/filterAlmacen", error);
        }
    }

    async filtrarParaVenta(req, res) {
        try {
            const result = await conec.procedure("CALL Filtrar_Productos_Para_Venta(?,?,?,?,?)", [
                parseInt(req.query.tipo),
                req.query.filtrar,
                req.query.idAlmacen,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina),
            ]);

            const resultLista = result.map(function (item, index) {
                return {
                    ...item,
                    imagen: firebaseService.getUrl(item.imagen),
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Filtrar_Productos_Para_Venta_Count(?,?,?)`, [
                parseInt(req.query.tipo),
                req.query.filtrar,
                req.query.idAlmacen,
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/filtrarParaVenta", error);
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

    async filterWeb(req, res) {
        try {
            const { buscar, filtros, posicionPagina, filasPorPagina } = req.body;

            const categoriasCSV = filtros?.categories?.map(item => item.id).join(',') || null;
            const marcasCSV = filtros?.brands?.map(item => item.id).join(',') || null;
            const coloresCSV = filtros?.colors?.map(item => item.id).join(',') || null;
            const tallasCSV = filtros?.sizes?.map(item => item.id).join(',') || null;
            const saboresCSV = filtros?.flavors?.map(item => item.id).join(',') || null;
            const precioMin = filtros?.priceRange ? Number(filtros.priceRange[0]) : null;
            const precioMax = filtros?.priceRange ? Number(filtros.priceRange[1]) : null;

            const web = await conec.query(`
            SELECT
                w.idWeb,
                w.idSucursal,
                w.idAlmacen
            FROM 
                web AS w
            LIMIT 1`);

            const filterData = {
                idAlmacen: web[0]?.idAlmacen,
                buscar: buscar || '',
                categorias: categoriasCSV || '',
                marcas: marcasCSV || '',
                colores: coloresCSV || '',
                tallas: tallasCSV || '',
                sabores: saboresCSV || '',
                precioMin,
                precioMax,
                posicionPagina: parseInt(posicionPagina),
                filasPorPagina: parseInt(filasPorPagina),
            };

            const cacheKey = PRODUCT_FILTER_WEB(filterData);

            // 1. Buscar en Redis
            const cached = await redisService.get(cacheKey);

            if (cached) {
                console.log('Redis HIT:', cacheKey);

                return sendSuccess(
                    res,
                    JSON.parse(cached)
                );
            }

            // 2. Si no existe en Redis, consultar DB
            const lista = await conec.procedure(`CALL Listar_Productos_Web(?,?,?,?,?,?,?,?,?,?,?)`, [
                toNullString(web[0]?.idAlmacen),
                toNullString(buscar),
                toNullString(categoriasCSV),
                toNullString(marcasCSV),
                toNullString(coloresCSV),
                toNullString(tallasCSV),
                toNullString(saboresCSV),
                toNullNumber(precioMin),
                toNullNumber(precioMax),
                parseInt(posicionPagina),
                parseInt(filasPorPagina)
            ]);

            const newLista = await lista.map((item, index) => {
                return {
                    ...item,
                    imagen: firebaseService.getUrl(item.imagen),
                    id: (index + 1) + parseInt(posicionPagina),
                };
            });

            const rows = await conec.procedure(`CALL Listar_Productos_Web_Count(?,?,?,?,?,?,?,?,?)`, [
                toNullString(web[0]?.idAlmacen),
                toNullString(buscar),
                toNullString(categoriasCSV),
                toNullString(marcasCSV),
                toNullString(coloresCSV),
                toNullString(tallasCSV),
                toNullString(saboresCSV),
                toNullNumber(precioMin),
                toNullNumber(precioMax),
            ]);

            // 3. Construir respuesta
            const response = this._mapFilterWebResponse(
                newLista,
                rows[0].Total
            );

            // 4. Guardar respuesta completa en Redis
            await redisService.set(
                cacheKey,
                JSON.stringify(response),
                3600 // 1 hora
            );

            // 5. Responder
            return sendSuccess(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/filterWeb", error);
        }
    }

    async filterWebId(req, res) {
        try {
            const { idProducto } = req.params;

            const cacheKey = PRODUCT_FILTER_WEB_ID(idProducto);

            // 1. Buscar en Redis
            const cached = await redisService.get(cacheKey);

            if (cached) {
                console.log('Redis HIT:', cacheKey);

                return sendSuccess(res, JSON.parse(cached));
            }

            // 2. Si no existe en Redis, consultar DB
            const web = await conec.query(`
            SELECT
                w.idWeb,
                w.idSucursal,
                w.idAlmacen
            FROM 
                web AS w
            LIMIT 1`);

            const producto = await conec.query(`
            SELECT 
                1 AS id,
                p.idProducto,
                p.nombre,
                p.codigo,
                p.sku,
                p.codigoBarras,

                p.idTipoProducto,

                p.descripcionCorta,
                p.descripcionLarga,
                pc.valor AS precio,
                p.imagen,

                c.idCategoria,
                c.nombre AS categoriaNombre,

                m.idMarca,
                m.nombre AS marcaNombre,

                me.idMedida,
                me.nombre AS nombreMedida,

                IFNULL(i.cantidad, 0) AS cantidad
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
                inventario AS i ON i.idProducto = p.idProducto AND i.idAlmacen = ?
            WHERE 
                p.estado = 1 
                AND 
                p.idProducto = ?`, [
                web[0].idAlmacen,
                idProducto,
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
                idProducto
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
                idProducto
            ]);

            const newImagenes = [];

            for (const image of imagenes) {
                newImagenes.push({
                    "idImagen": image.id,
                    "nombre": image.nombre,
                    "url": firebaseService.getUrl(image.nombre),
                    "ancho": image.ancho,
                    "alto": image.alto,
                });
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
                idProducto
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
                idProducto
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
                idProducto
            ]);

            // 3. Construir respuesta
            const response = this._mapFilterWebIdResponse(
                producto[0],
                detalles,
                newImagenes,
                colores,
                tallas,
                sabores,
            );

            // 4. Guardar respuesta completa en Redis
            await redisService.set(
                cacheKey,
                JSON.stringify(response),
            );

            // 5. Responder
            return sendSuccess(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/filterWebPages", error);
        }
    }

    async filterWebRelationsId(req, res) {
        try {
            const { idProducto, idCategoria } = req.params;

            const cacheKey = PRODUCT_FILTER_WEB_RELATED_ID(idProducto, idCategoria);

            // 1. Buscar en Redis
            const cached = await redisService.get(cacheKey);

            if (cached) {
                console.log('Redis HIT:', cacheKey);
                return sendSuccess(res, JSON.parse(cached));
            }

            // 2. Si no existe en Redis, consultar DB
            const web = await conec.query(`
            SELECT
                w.idWeb,
                w.idSucursal,
                w.idAlmacen
            FROM 
                web AS w
            LIMIT 1`);

            const list = await conec.query(`
            SELECT 
                p.idProducto,
                p.nombre,
                p.codigo,
                p.sku,
                p.codigoBarras,
                p.idTipoProducto,
                p.descripcionCorta,
                p.descripcionLarga,
                pc.valor AS precio,
                p.imagen,

                c.idCategoria,
                c.nombre AS categoriaNombre,

                m.idMarca,
                m.nombre AS marcaNombre,

                me.idMedida,
                me.nombre AS nombreMedida,

                IFNULL(i.cantidad, 0) AS cantidad
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
                inventario AS i ON i.idProducto = p.idProducto AND i.idAlmacen = ?
            WHERE
                p.estado = 1 
                AND p.publicar = 1 
                AND p.idProducto <> ? 
                AND p.idCategoria = ? 
            ORDER BY 
                p.fecha DESC, p.hora DESC
            LIMIT 4`, [
                web[0].idAlmacen,
                idProducto,
                idCategoria,
                web[0].idSucursal
            ]);

            // 3. Construir respuesta
            const response = this._mapFilterWebRelationsIdResponse(list);

            // 4. Guardar respuesta completa en Redis
            await redisService.set(
                cacheKey,
                JSON.stringify(response),
                21600
            );

            // 5. Responder
            return sendSuccess(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/filterWebPages", error);
        }
    }

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

    async dashboard(req, res) {
        try {
            const result = await conec.procedureAll(`CALL Dashboard_Producto(?,?,?,?)`, [
                req.body.fechaInicio,
                req.body.fechaFinal,
                req.body.idSucursal,
                req.body.idAlmacen
            ]);

            return sendSuccess(res, {
                // Resumen Financiero Diario
                "1": {
                    data: result[0][0],
                    descripcion: "Resumen Financiero Diario"
                },
                // Productos Vendidos con Detalles de Costo y Ganancia
                "2": {
                    data: result[1].length > 0 ? result[1].map((item) => {
                        return {
                            ...item,
                            imagen: firebaseService.getUrl(item.imagen),
                        };
                    }) : [],
                    descripcion: "Productos Vendidos con Detalles de Costo y Ganancia"
                },
                // Productos Más Vendidos (Top 3)
                "3": {
                    data: result[2],
                    descripcion: "Productos Más Vendidos (Top 3)"
                },
                // Estado de Inventario para Productos con Movimiento
                "4": {
                    data: result[3][0],
                    descripcion: "Estado de Inventario para Productos con Movimiento"
                },
                // Rendimiento por Categoría con Análisis de Margen
                "5": {
                    data: result[4],
                    descripcion: "Rendimiento por Categoría con Análisis de Margen"
                },
                // Productos con Bajo Inventario que Requieren Reorden
                "6": {
                    data: result[5].length > 0 ? result[5].map((item) => {
                        return {
                            ...item,
                            imagen: firebaseService.getUrl(item.imagen),
                        };
                    }) : [],
                    descripcion: "Productos con Bajo Inventario que Requieren Reorden"
                },
                // Productos sin Ventas Hoy pero con Inventario Disponible
                "7": {
                    data: result[6].length > 0 ? result[6].map((item) => {
                        return {
                            ...item,
                            imagen: firebaseService.getUrl(item.imagen),
                        };
                    }) : [],
                    descripcion: "Productos sin Ventas Hoy pero con Inventario Disponible"
                },
            });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/dashboard", error);
        }
    }

    _mapFilterWebResponse(productos, count) {
        const products = productos.map((item) => {
            return {
                id: item.id,
                idProduct: item.idProducto,
                code: item.codigo,
                sku: item.sku,
                codeBar: item.codigoBarras,
                name: item.nombre,
                description: item.descripcionCorta,
                price: item.precio,
                idCategory: item.idCategoria,
                category: { id: item.idCategoria, name: item.nombreCategoria },
                idMeasure: item.idMedida,
                measure: { id: item.idMedida, name: item.nombreMedida },
                image: item.imagen,
                stock: item.cantidad,
                typeProduct: {
                    id: item.idTipoProducto,
                    code: item.codigoTipoProducto,
                    name: item.nombreTipoProducto,
                },
            }
        });

        return {
            "data": products,
            "count": count
        }
    }

    _mapFilterWebIdResponse(producto, detalles, imagenes, colores, tallas, sabores) {
        let images = [];
        const imagen = firebaseService.getUrl(producto.imagen);

        if (producto.imagen) {
            images.push({
                id: "principal-1",
                name: producto.nombre,
                url: imagen,
                width: 600,
                height: 400
            })
        }

        if (imagenes.lenght !== 0) {
            imagenes.forEach((image) => {
                images.push({
                    id: image.idImagen,
                    name: image.nombre,
                    url: image.url,
                    width: image.ancho,
                    height: image.alto
                })
            })
        }

        if (!imagen && (!producto.imagenes || producto.imagenes.length === 0)) {
            images.push({
                id: "1",
                name: "Default",
                url: "/placeholder.svg",
                width: 600,
                height: 400
            })
        }

        return {
            id: producto.id,
            idProduct: producto.idProducto,
            code: producto.codigo,
            sku: producto.sku,
            codeBar: producto.codigoBarras,
            name: producto.nombre,
            description: producto.descripcionCorta,
            descriptionLong: producto.descripcionLarga,
            price: producto.precio,
            idCategory: producto.idCategoria,
            idBrand: producto.idMarca,
            image: imagen,
            isNew: true,
            stock: producto.cantidad,
            typeProduct: {
                id: producto.idTipoProducto,
            },
            category: {
                id: producto.idCategoria,
                name: producto.categoriaNombre
            },
            brand: {
                id: producto.idMarca,
                name: producto.marcaNombre
            },
            measure: {
                id: producto.idMedida,
                name: producto.nombreMedida
            },
            details: detalles.map((item) => ({ id: item.id, name: item.nombre, value: item.valor })),
            images: images,
            colors: colores.map((item) => ({ id: item.idAtributo, name: item.nombre, hexadecimal: item.hexadecimal })),
            sizes: tallas.map((item) => ({ id: item.idAtributo, name: item.nombre, value: item.valor })),
            flavors: sabores.map((item) => ({ id: item.idAtributo, name: item.nombre, value: item.valor })),
        }
    }

    _mapFilterWebRelationsIdResponse(productos) {
        return productos.map((item, index) => {
            return {
                id: (index + 1),
                idProduct: item.idProducto,
                code: item.codigo,
                name: item.nombre,
                description: item.descripcionCorta,
                descriptionLong: item.descripcionLarga,
                price: item.precio,
                idCategory: item.idCategoria,
                idBrand: item.idMarca,
                image: firebaseService.getUrl(item.imagen),
                isNew: true,
                stock: item.cantidad,
                isService: item.servicio === 1 ? true : false,
                category: { id: item.idCategoria, name: item.categoriaNombre },
                brand: { id: item.idMarca, name: item.marcaNombre },
                measure: { id: item.idMedida, name: item.nombreMedida },
                typeProduct: {
                    id: item.idTipoProducto,
                },
            }
        });
    }

}

module.exports = Producto;