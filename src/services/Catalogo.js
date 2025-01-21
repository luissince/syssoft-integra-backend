require("@aws-sdk/client-s3");
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

require('dotenv').config();

class Catalogo {

    async list(req, res) {
        try {
            const list = await conec.procedure(`CALL Listar_Catalogos(?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            const resultLista = list.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_Catalogos_Count(?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Catalogo/list", error);
        }
    }

    async create(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            // Genera un nuevo ID para el catálogo
            const listCatalogos = await conec.execute(connection, `SELECT idCatalogo FROM catalogo`);
            const idCatalogo = generateAlphanumericCode("CT0001", listCatalogos, 'idCatalogo');

            await conec.execute(connection, `
                INSERT INTO catalogo(
                    idCatalogo,
                    idSucursal,
                    nombre,
                    fecha,
                    hora,
                    idUsuario
                ) VALUES(?,?,?,?,?,?)`, [
                idCatalogo,
                req.body.idSucursal,
                req.body.nombre,
                currentDate(),
                currentTime(),
                req.body.idUsuario,
            ]);

            let count = 0;

            for (const item of req.body.productos) {
                count++;
                await conec.execute(connection, `
                    INSERT INTO catalogoDetalle(
                        idCatalogoDetalle,
                        idCatalogo,
                        idProducto
                    ) VALUES(?,?,?)`, [
                    count,
                    idCatalogo,
                    item.idProducto
                ]);
            }

            await conec.commit(connection);
            return sendSave(res, {
                idCatalogo: idCatalogo,
                message: "Datos registrados correctamente.",
            });
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Catalogo/create", error);
        }
    }

    async id(req, res) {
        try {
            const catalogo = await conec.query(`
            SELECT 
                p.idCatalogo,
                p.nombre,
                p.fecha,
                p.hora
            FROM 
                catalogo AS p
            WHERE 
                p.idCatalogo = ?`, [
                req.params.idCatalogo
            ]);

            const detalles = await conec.query(`
                SELECT
                    idCatalogoDetalle AS id,
                    p.idProducto,
                    p.imagen,
                    p.codigo,
                    p.nombre,
                    p.costo,
                    pc.valor AS precio,
                    c.nombre AS categoria,
                    tp.nombre as tipoProducto,
                    p.idTipoTratamientoProducto,
                    p.idMedida,
                    me.nombre AS unidad
                FROM 
                    catalogoDetalle AS cd
                INNER JOIN 
                    producto AS p ON p.idProducto = cd.idProducto
                INNER JOIN 
                    medida AS me ON me.idMedida = p.idMedida
                INNER JOIN 
                    categoria AS c ON c.idCategoria = p.idCategoria
                INNER JOIN 
                    tipoProducto AS tp ON tp.idTipoProducto = p.idTipoProducto
                INNER JOIN 
                    precio AS pc ON pc.idProducto = p.idProducto AND pc.preferido = 1
                WHERE 
                    cd.idCatalogo = ?
                ORDER BY 
                    cd.idCatalogoDetalle ASC`, [
                req.params.idCatalogo
            ]);

            const bucket = firebaseService.getBucket();
            const listaDetalles = detalles.map(item => {
                if (bucket && item.imagen) {
                    return {
                        ...item,
                        imagen: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
                    }
                }
                return {
                    ...item,
                }
            });

            return sendSuccess(res, { "cabecera": catalogo[0], "detalles": listaDetalles });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Catalogo/id", error);
        }
    }

    async detail(req, res) {
        try {
            const catalogo = await conec.query(`
            SELECT 
                p.idCatalogo,
                p.nombre,
                DATE_FORMAT(p.fecha,'%d/%m/%Y') as fecha,
                p.hora,   
                CONCAT(u.nombres,' ',u.apellidos) AS usuario
            FROM 
                catalogo AS p
            INNER JOIN 
                usuario AS u ON u.idUsuario = p.idUsuario
            WHERE 
                p.idCatalogo = ?`, [
                req.params.idCatalogo
            ]);

            const detalles = await conec.query(`
                SELECT
                    idCatalogoDetalle AS id,
                    p.idProducto,
                    p.nombre,
                    p.codigo,
                    p.imagen
                FROM 
                    catalogoDetalle AS cd
                INNER JOIN 
                    producto AS p ON p.idProducto = cd.idProducto
                WHERE 
                    cd.idCatalogo = ?
                ORDER BY 
                    cd.idCatalogoDetalle ASC`, [
                req.params.idCatalogo
            ]);

            const bucket = firebaseService.getBucket();
            const listaDetalles = detalles.map(item => {
                if (bucket && item.imagen) {
                    return {
                        ...item,
                        imagen: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
                    }
                }
                return {
                    ...item,
                }
            });

            return sendSuccess(res, {
                "cabecera": catalogo[0],
                "detalles": listaDetalles
            });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Catalogo/id", error);
        }
    }

    async update(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            await conec.execute(connection, `
            UPDATE 
                catalogo 
            SET
                nombre = ?,
                fecha = ?,
                hora = ?
            WHERE 
                idCatalogo = ?`, [
                req.body.nombre,
                currentDate(),
                currentTime(),
                req.body.idCatalogo,
            ]);

            await conec.execute(connection, `DELETE FROM catalogoDetalle WHERE idCatalogo = ?`, [
                req.body.idCatalogo
            ]);

            let count = 0;
            for (const item of req.body.productos) {
                count++;
                await conec.execute(connection, `
                    INSERT INTO catalogoDetalle(
                        idCatalogoDetalle,
                        idCatalogo,
                        idProducto
                    ) VALUES(?,?,?)`, [
                    count,
                    req.body.idCatalogo,
                    item.idProducto
                ]);
            }

            await conec.commit(connection);
            return sendSave(res, {
                idCatalogo: req.body.idCatalogo,
                message: "Datos actualizdos correctamente.",
            });
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Catalogo/update", error);
        }
    }

    async documentsPdfCatalog(req, res) {
        try {

            const empresa = await conec.query(`
                SELECT
                    documento,
                    razonSocial,
                    nombreEmpresa,
                    rutaLogo
                FROM 
                    empresa`);

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
                    s.principal = 1`);

            const moneda = await conec.query(`
                SELECT 
                    codiso,
                    simbolo
                FROM 
                    moneda 
                WHERE 
                    nacional = 1;`);

            const productos = await conec.query(`
                SELECT 
                    p.idProducto,
                    p.nombre,
                    p.codigo,
                    p.imagen,
                    p.descripcionCorta
                FROM 
                    catalogo AS c
                INNER JOIN 
                    catalogoDetalle AS cd ON c.idCatalogo = cd.idCatalogo
                INNER JOIN
                    producto AS p ON cd.idProducto = p.idProducto
                WHERE 
                    c.idCatalogo = ?
                ORDER BY 
                    p.nombre ASC`, [
                req.params.idCatalogo
            ]);

            const bucket = firebaseService.getBucket();
            const products = await Promise.all(productos.map(async (item) => {
                const precios = await conec.query(`
                    SELECT
                        ROW_NUMBER() OVER () AS id,
                        nombre,
                        valor AS precio
                    FROM 
                        precio 
                    WHERE 
                        idProducto = ? AND preferido = 1`, [
                    item.idProducto
                ]);

                if (bucket && item.imagen) {
                    return {
                        ...item,
                        imagen: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
                        precios,
                    }
                }
                return {
                    ...item,
                    imagen: `${process.env.APP_URL}/files/to/noimage.png`,
                    precios,
                }
            }));

            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/product/pdf/catalog`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    "company": {
                        ...empresa[0],
                        rutaLogo: empresa[0].rutaLogo && bucket ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${empresa[0].rutaLogo}` : null,
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
                    "moneda": moneda[0],
                    "products": products
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Producto/documentsPdfCatalog", error);
        }
    }

}

module.exports = Catalogo;