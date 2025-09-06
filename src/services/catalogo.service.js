const Conexion = require('../database/Conexion');
const {
    currentDate,
    currentTime,
    generateAlphanumericCode,
} = require('../tools/Tools');
const FirebaseService = require('../tools/FiraseBaseService');
const { default: axios } = require("axios");
const conec = new Conexion();
const firebaseService = new FirebaseService();

class Catalogo {

    async list(data) {
        const list = await conec.procedure(`CALL Listar_Catalogos(?,?,?,?)`, [
            parseInt(data.opcion),
            data.buscar,
            parseInt(data.posicionPagina),
            parseInt(data.filasPorPagina)
        ]);

        const resultLista = list.map(function (item, index) {
            return {
                ...item,
                id: (index + 1) + parseInt(data.posicionPagina)
            }
        });

        const total = await conec.procedure(`CALL Listar_Catalogos_Count(?,?)`, [
            parseInt(data.opcion),
            data.buscar
        ]);

        return { "result": resultLista, "total": total[0].Total };
    }

    async create(data) {
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
                data.idSucursal,
                data.nombre,
                currentDate(),
                currentTime(),
                data.idUsuario,
            ]);

            let count = 0;

            for (const item of data.productos) {
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
            return {
                idCatalogo: idCatalogo,
                message: "Datos registrados correctamente.",
            };
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }

            throw error;
        }
    }

    async id(data) {
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
            data.idCatalogo
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
            data.idCatalogo
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

        return { "cabecera": catalogo[0], "detalles": listaDetalles };
    }

    async detail(data) {
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
            data.idCatalogo
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
            data.idCatalogo
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

        return {
            "cabecera": catalogo[0],
            "detalles": listaDetalles
        };
    }

    async update(data) {
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
                data.nombre,
                currentDate(),
                currentTime(),
                data.idCatalogo,
            ]);

            await conec.execute(connection, `DELETE FROM catalogoDetalle WHERE idCatalogo = ?`, [
                data.idCatalogo
            ]);

            let count = 0;
            for (const item of data.productos) {
                count++;
                await conec.execute(connection, `
                    INSERT INTO catalogoDetalle(
                        idCatalogoDetalle,
                        idCatalogo,
                        idProducto
                    ) VALUES(?,?,?)`, [
                    count,
                    data.idCatalogo,
                    item.idProducto
                ]);
            }

            await conec.commit(connection);
            return {
                idCatalogo: data.idCatalogo,
                message: "Datos actualizdos correctamente.",
            };
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }

            throw error;
        }
    }

    async documentsPdfCatalog(data) {
        const catalogo = await conec.query(`
            SELECT 
                c.idCatalogo,
                c.pdfKey,
                c.pdfEstado
            FROM 
                catalogo c
            WHERE 
                c.idCatalogo = ?`, [
            data.idCatalogo
        ]);

        if (catalogo.length === 0) {
            throw new Error("No se encontro registros de la catalogo.");
        }

        if (catalogo[0].pdfEstado === "PENDIENTE") {
            return {
                status: "procesando",
                message: "El catálogo se está generando. Intente nuevamente en un par de minutos.",
            }
        }

        if (catalogo[0].pdfEstado === "ERROR") {
            throw new Error("Se produjo un error al generar el catálogo.");
        }

        if (catalogo[0].pdfKey) {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/product/pdf/catalog/get`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    "key": catalogo[0].pdfKey
                },
            };

            const response = await axios.request(options);

            return response.data;
        }

        await conec.query(`
            UPDATE 
                catalogo 
            SET 
                pdfEstado = 'PENDIENTE' 
            WHERE 
                idCatalogo = ?`, [
            data.idCatalogo
        ]);

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
                    p.descripcionCorta,
                    md.nombre AS nombreMedido
                FROM 
                    catalogo AS c
                INNER JOIN 
                    catalogoDetalle AS cd ON c.idCatalogo = cd.idCatalogo
                INNER JOIN
                    producto AS p ON cd.idProducto = p.idProducto
                INNER JOIN 
                    medida AS md ON md.idMedida = p.idMedida 
                WHERE 
                    c.idCatalogo = ?
                ORDER BY 
                    p.nombre ASC`, [
            data.idCatalogo
        ]);

        const bucket = firebaseService.getBucket();
        const products = await Promise.all(productos.map(async (item) => {
            // Clonar el objeto eliminando 'nombreMedido'
            const { nombreMedido, ...copy } = item;

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

            return {
                ...copy,
                imagen: bucket && item.imagen
                    ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`
                    : `${process.env.APP_URL}/files/to/default.png`,
                medida: { nombre: nombreMedido },
                precios,
            };
        }));

        const options = {
            method: 'POST',
            url: `${process.env.APP_PDF}/product/pdf/catalog/process`,
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
                "catalog": catalogo[0],
                "moneda": moneda[0],
                "products": products,
                "webhook": `${process.env.APP_URL}/api/catalogo/documents/pdf/webhook`
            },
            // responseType: 'arraybuffer'
        };

        axios
            .request(options)
            .catch(err => console.error("Error enviando a PDF service:", err.message));

        return {
            status: "procesando",
            message: "El catálogo se está generando. Intente nuevamente en un par de minutos."
        };
    }

    async updateCatalogPdf(data) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            await conec.execute(connection, `
            UPDATE
                catalogo 
            SET
                pdfKey = ?,
                pdfEstado = ?
            WHERE
                idCatalogo = ?`, [
                data.key,
                data.status,
                data.idCatalogo
            ]);

            await conec.commit(connection);

            return {
                message: 'Catalogo actualizado correctamente.',
            }
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }

            throw error;
        }
    }

}

module.exports = new Catalogo();