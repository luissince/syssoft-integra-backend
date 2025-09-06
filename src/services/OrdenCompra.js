const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode, sleep } = require('../tools/Tools');
const { sendSuccess, sendError, sendSave, sendFile, sendClient } = require('../tools/Message');
const Conexion = require('../database/Conexion');
const { default: axios } = require('axios');
const FirebaseService = require('../tools/FiraseBaseService');
const conec = new Conexion();
const firebaseService = new FirebaseService();

class OrdenCompra {

    async list(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Ordenes_Compra(?,?,?,?,?,?,?,?)`, [
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

            const total = await conec.procedure(`CALL Listar_Ordenes_Compra_Count(?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idSucursal,
                parseInt(req.query.estado),
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "OrdenCompra/list", error)
        }
    }

    async id(req, res) {
        try {
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
                c.nota
            FROM 
                ordenCompra AS c
            INNER JOIN 
                persona AS p ON p.idPersona = c.idProveedor
            WHERE 
                c.idOrdenCompra = ?`, [
                req.query.idOrdenCompra,
            ]);

            const detalles = await conec.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY cd.idOrdenCompraDetalle ASC) AS id,
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
                cd.costo,
                tp.nombre as tipoProducto,
                p.idTipoTratamientoProducto
            from 
                ordenCompraDetalle AS cd
            INNER JOIN 
                producto AS p ON cd.idProducto = p.idProducto
            INNER JOIN 
                tipoProducto AS tp ON tp.idTipoProducto = p.idTipoProducto
            INNER JOIN 
                medida AS m ON m.idMedida = p.idMedida
            INNER JOIN 
                impuesto AS i ON cd.idImpuesto = i.idImpuesto
            WHERE 
                cd.idOrdenCompra = ?
            ORDER BY 
                cd.idOrdenCompraDetalle ASC`, [
                req.query.idOrdenCompra,
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "OrdenCompra/id", error)
        }
    }

    async detail(req, res) {
        try {
            // Consulta la información principal de la orden de compra
            const ordenCompra = await conec.query(`
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
                mo.codiso,
                CONCAT(us.nombres,' ',us.apellidos) AS usuario
            FROM 
                ordenCompra AS c
            INNER JOIN 
                comprobante AS co ON co.idComprobante = c.idComprobante
            INNER JOIN 
                moneda AS mo ON mo.idMoneda = c.idMoneda
            INNER JOIN 
                persona AS cn ON cn.idPersona = c.idProveedor
            INNER JOIN 
                usuario AS us ON us.idUsuario = c.idUsuario 
            WHERE 
                c.idOrdenCompra = ?`, [
                req.query.idOrdenCompra,
            ]);

            // Consulta los detalles de la orden de compra
            const detalles = await conec.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY cd.idOrdenCompraDetalle ASC) AS id,
                p.imagen,
                p.codigo,
                p.nombre AS producto,
                md.nombre AS medida, 
                m.nombre AS categoria, 
                cd.costo,
                cd.cantidad,
                cd.idImpuesto,
                imp.nombre AS impuesto,
                imp.porcentaje
            FROM 
                ordenCompraDetalle AS cd 
            INNER JOIN 
                producto AS p ON cd.idProducto = p.idProducto 
            INNER JOIN 
                medida AS md ON md.idMedida = cd.idMedida 
            INNER JOIN 
                categoria AS m ON p.idCategoria = m.idCategoria 
            INNER JOIN 
                impuesto AS imp ON cd.idImpuesto = imp.idImpuesto 
            WHERE
                cd.idOrdenCompra = ?
            ORDER BY 
                cd.idOrdenCompraDetalle ASC`, [
                req.query.idOrdenCompra,
            ]);

            const bucket = firebaseService.getBucket();
            const listaDetalles = detalles.map(item => {
                return {
                    ...item,
                    imagen: bucket && item.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : null,
                }
            });

            // Consulta los compras asociadas
            const compras = await conec.query(`
                SELECT 
                    ROW_NUMBER() OVER (ORDER BY c.idCompra DESC) AS id,
                    c.idCompra,
                    DATE_FORMAT(c.fecha, '%d/%m/%Y') AS fecha,
                    c.hora,
                    cc.nombre AS comprobante,
                    c.serie,
                    c.numeracion,
                    c.estado,
                    m.codiso,
                    SUM(cd.costo * cd.cantidad) AS total
                FROM 
                    compraOrdenCompra AS cod 
                INNER JOIN 
                    ordenCompra AS oc ON oc.idOrdenCompra = cod.idOrdenCompra
                INNER JOIN 
                    compra AS c ON c.idCompra = cod.idCompra AND c.estado <> 3
                INNER JOIN 
                    moneda AS m ON m.idMoneda = c.idMoneda
                INNER JOIN 
                    compraDetalle AS cd ON cd.idCompra = c.idCompra
                INNER JOIN 
                    comprobante AS cc ON cc.idComprobante = c.idComprobante
                WHERE 
                    cod.idOrdenCompra = ? 
                GROUP BY 
                    c.idCompra, c.fecha, c.hora, cc.nombre, c.serie, c.numeracion, c.estado,  m.codiso
                ORDER BY 
                    c.fecha DESC, c.hora DESC`, [
                req.query.idOrdenCompra,
            ]);

            const comprados = await conec.query(`
                SELECT 
                    p.idProducto,
                    SUM(cd.cantidad) AS cantidad
                FROM 
                    compraOrdenCompra AS oc
                INNER JOIN
                    compra AS c ON c.idCompra = oc.idCompra AND c.estado <> 3
                INNER JOIN
                    compraDetalle AS cd ON cd.idCompra = c.idCompra
                INNER JOIN
                    producto AS p ON p.idProducto = cd.idProducto
                WHERE 
                    oc.idOrdenCompra = ?
                GROUP BY 
                    p.idProducto`, [
                req.query.idOrdenCompra
            ]);

            // Devuelve un objeto con la información del ordenCompra, los detalles y las salidas
            return sendSuccess(res, { cabecera: ordenCompra[0], detalles: listaDetalles, compras, comprados });
        } catch (error) {
            // Manejo de errores: Si hay un error, devuelve un mensaje de error
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "OrdenCompra/detail", error)
        }
    }

    async forPurchase(req, res) {
        try {
            const validate = await conec.query(`
                SELECT 
                    *
                FROM 
                    ordenCompra
                WHERE 
                    idOrdenCompra = ? AND estado = 0`, [
                req.query.idOrdenCompra
            ]);

            if (validate.length !== 0) {
                return sendClient(res, "La orden de compra se encuentra anulada.");
            }

            const proveedor = await conec.query(`
                SELECT                 
                    p.idPersona,
                    p.idTipoDocumento,
                    p.documento,
                    p.informacion,
                    IFNULL(p.celular,'') AS celular,
                    IFNULL(p.email,'') AS email,
                    IFNULL(p.direccion,'') AS direccion
                FROM 
                    ordenCompra AS c
                INNER JOIN 
                    persona AS p ON p.idPersona = c.idProveedor
                WHERE 
                    c.idOrdenCompra = ?`, [
                req.query.idOrdenCompra
            ]);

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
                req.query.idOrdenCompra
            ]);

            const detalles = await conec.query(`
                SELECT 
                    ocd.idProducto,
                    ocd.costo,
                    ocd.cantidad
                FROM
                    ordenCompraDetalle AS ocd
                WHERE
                    ocd.idOrdenCompra = ?
                ORDER BY 
                    ocd.idOrdenCompraDetalle ASC`, [
                req.query.idOrdenCompra
            ]);

            const newDetalles = detalles
                .map((detalle) => {
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
                })
                .filter(Boolean);

            let productos = [];

            let index = 0;
            for (const item of newDetalles) {
                const producto = await conec.query(`
                SELECT 
                    p.idProducto,
                    p.imagen,
                    p.codigo,
                    p.sku,
                    p.codigoBarras,
                    p.nombre,
                    p.costo,
                    c.nombre AS categoria,
                    tp.nombre as tipoProducto,
                    p.idTipoTratamientoProducto,
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
                WHERE 
                    p.idProducto = ?`, [
                    item.idProducto,
                ]);

                const bucket = firebaseService.getBucket();
                const newProducto = {
                    ...producto[0],
                    costo: item.costo,
                    cantidad: item.cantidad,
                    imagen: bucket && producto[0].imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${producto[0].imagen}` : null,
                    id: index + 1
                }

                productos.push(newProducto);
            }

            // Devuelve un objeto con la información de la compra, los detalles y las salidas
            return sendSuccess(res, { proveedor: proveedor[0], productos });
        } catch (error) {
            // Manejo de errores: Si hay un error, devuelve un mensaje de error
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "OrdenCompra/forPurchase", error)
        }
    }

    async create(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            // Genera un nuevo ID para ela orden de compra
            const result = await conec.execute(connection, 'SELECT idOrdenCompra FROM ordenCompra');
            const idOrdenCompra = generateAlphanumericCode("OC0001", result, 'idOrdenCompra');

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

            // Consulta numeraciones de las ordenes de compra asociadas al mismo comprobante
            const ordenCompras = await conec.execute(connection, `
            SELECT 
                numeracion  
            FROM 
                ordenCompra 
            WHERE 
                idComprobante = ?`, [
                req.body.idComprobante
            ]);

            // Genera una nueva numeración para la orden de compra
            const numeracion = generateNumericCode(comprobante[0].numeracion, ordenCompras, "numeracion");

            await conec.execute(connection, `INSERT INTO ordenCompra(
                idOrdenCompra,
                idProveedor,
                idUsuario,
                idComprobante,
                idSucursal,
                idMoneda,
                serie,
                numeracion,
                observacion,
                nota,
                estado,
                fecha,
                hora
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idOrdenCompra,
                req.body.idProveedor,
                req.body.idUsuario,
                req.body.idComprobante,
                req.body.idSucursal,
                req.body.idMoneda,
                comprobante[0].serie,
                numeracion,
                req.body.observacion,
                req.body.nota,
                req.body.estado,
                currentDate(),
                currentTime(),
            ]);

            // Genera un nuevo ID para los detalles del ordenCompra
            const listaOrdenCompraDetalle = await conec.execute(connection, 'SELECT idOrdenCompraDetalle FROM ordenCompraDetalle');
            let idOrdenCompraDetalle = generateNumericCode(1, listaOrdenCompraDetalle, 'idOrdenCompraDetalle');

            // Inserta los detalles de compra en la base de datos
            for (const item of req.body.detalle) {
                await await conec.execute(connection, `INSERT INTO ordenCompraDetalle(
                    idOrdenCompraDetalle,
                    idOrdenCompra,
                    idProducto,
                    idMedida,
                    costo,
                    cantidad,
                    idImpuesto
                ) VALUES(?,?,?,?,?,?,?)`, [
                    idOrdenCompraDetalle,
                    idOrdenCompra,
                    item.idProducto,
                    item.idMedida,
                    item.costo,
                    item.cantidad,
                    item.idImpuesto
                ]);

                idOrdenCompraDetalle++;
            }

            await conec.commit(connection);
            return sendSave(res, {
                idOrdenCompra: idOrdenCompra,
                message: "Se registró correctamente la orden de compra."
            });
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "OrdenCompra/create", error)
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
                compraOrdenCompra AS vc
            INNER JOIN
                compra AS v ON v.idCompra = vc.idCompra AND v.estado <> 3
            WHERE 
                vc.idOrdenCompra = ?`, [
                req.body.idOrdenCompra
            ]);

            if (validate.length !== 0) {
                await conec.rollback(connection);
                return sendClient(res, "La orden de compra ya esta ligado a una compra y no se puede editar.");
            }

            await conec.execute(connection, `
            UPDATE 
                ordenCompra 
            SET
                idProveedor = ?,
                idUsuario = ?,
                idSucursal = ?,
                idMoneda = ?,
                observacion = ?,
                nota = ?,
                estado = ?,
                fecha = ?,
                hora = ?
            WHERE 
                idOrdenCompra = ?`, [
                req.body.idProveedor,
                req.body.idUsuario,
                req.body.idSucursal,
                req.body.idMoneda,
                req.body.observacion,
                req.body.nota,
                req.body.estado,
                currentDate(),
                currentTime(),
                req.body.idOrdenCompra,
            ]);

            await conec.execute(connection, `
            DELETE FROM 
                ordenCompraDetalle
            WHERE 
                idOrdenCompra = ?`, [
                req.body.idOrdenCompra,
            ]);

            const listaOrdenCompraDetalle = await conec.execute(connection, 'SELECT idOrdenCompraDetalle FROM ordenCompraDetalle');
            let idOrdenCompraDetalle = generateNumericCode(1, listaOrdenCompraDetalle, 'idOrdenCompraDetalle');

            // Inserta los detalles de la orden de compra en la base de datos
            for (const item of req.body.detalle) {
                await await conec.execute(connection, `
                INSERT INTO ordenCompraDetalle(
                    idOrdenCompraDetalle,
                    idOrdenCompra,
                    idProducto,
                    idMedida,
                    costo,
                    cantidad,
                    idImpuesto
                ) VALUES(?,?,?,?,?,?,?)`, [
                    idOrdenCompraDetalle,
                    req.body.idOrdenCompra,
                    item.idProducto,
                    item.idMedida,
                    item.costo,
                    item.cantidad,
                    item.idImpuesto
                ]);

                idOrdenCompraDetalle++;
            }

            await conec.commit(connection);
            return sendSave(res, {
                idOrdenCompra: req.body.idOrdenCompra,
                message: "Se actualizó correctamente la orden de compra."
            });
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "OrdenCompra/update", error)
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
                compraOrdenCompra AS vc
            INNER JOIN
                compra AS v ON v.idCompra = vc.idCompra AND v.estado <> 3
            WHERE 
                vc.idOrdenCompra = ?`, [
                req.query.idOrdenCompra
            ]);

            if (validate.length !== 0) {
                await conec.rollback(connection);
                return sendClient(res, "El ordend e compra ya esta ligado a una compra y no se puede anular.");
            }

            const ordenCompra = await conec.execute(connection, `
            SELECT
                estado
            FROM
                ordenCompra
            WHERE
                idOrdenCompra = ?`, [
                req.query.idOrdenCompra
            ]);

            if (ordenCompra.length === 0) {
                await conec.rollback(connection);
                return sendClient(res, "No se encontro registros de la orden de compra.");
            }

            if (ordenCompra[0].estado === 0) {
                await conec.rollback(connection);
                return sendClient(res, "La orden de compra ya se encuentra anulado.");
            }

            await conec.execute(connection, `
            UPDATE 
                ordenCompra
            SET 
                estado = 0
            WHERE
                idOrdenCompra = ?`, [
                req.query.idOrdenCompra
            ]);

            await conec.commit(connection);
            return sendSave(res, "Se anuló correctamente la orden de compra.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "OrdenCompra/cancel", error)
        }
    }

    async documentsPdfInvoicesOrList(req, res) {
        try {
            const { idOrdenCompra, size } = req.params;

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

            const ordenCompra = await conec.query(`
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
                ordenCompra AS p
            INNER JOIN
                comprobante AS c ON c.idComprobante = p.idComprobante
            INNER JOIN
                persona AS cp ON cp.idPersona = p.idProveedor
            INNER JOIN
                moneda AS m ON m.idMoneda = p.idMoneda
            INNER JOIN
                usuario AS u ON u.idUsuario = p.idUsuario
            WHERE 
                p.idOrdenCompra = ?`, [
                idOrdenCompra
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
                ordenCompra[0].idSucursal
            ]);

            const detalles = await conec.query(` 
            SELECT 
                ROW_NUMBER() OVER (ORDER BY gd.idOrdenCompraDetalle ASC) AS id,
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
                ordenCompraDetalle AS gd
            INNER JOIN 
                producto AS p ON gd.idProducto = p.idProducto
            INNER JOIN 
                medida AS m ON m.idMedida = p.idMedida
            INNER JOIN
                impuesto AS i ON i.idImpuesto = gd.idImpuesto
            WHERE 
                gd.idOrdenCompra = ?
            ORDER BY 
                gd.idOrdenCompraDetalle ASC`, [
                idOrdenCompra
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
                ordenCompra[0].idSucursal
            ]);

            return {
                "size": size,
                "company": {
                    ...empresa[0],
                    rutaLogo: bucket && empresa[0].rutaLogo ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${empresa[0].rutaLogo}` : null,
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
                "purchaseOrder": {
                    "fecha": ordenCompra[0].fecha,
                    "hora": ordenCompra[0].hora,
                    "nota": ordenCompra[0].nota,
                    "comprobante": {
                        "nombre": ordenCompra[0].comprobante,
                        "serie": ordenCompra[0].serie,
                        "numeracion": ordenCompra[0].numeracion
                    },
                    "proveedor": {
                        "documento": ordenCompra[0].documento,
                        "informacion": ordenCompra[0].informacion,
                        "direccion": ordenCompra[0].direccion
                    },
                    "moneda": {
                        "nombre": ordenCompra[0].moneda,
                        "simbolo": ordenCompra[0].simbolo,
                        "codiso": ordenCompra[0].codiso
                    },
                    "usuario": {
                        "apellidos": ordenCompra[0].apellidos,
                        "nombres": ordenCompra[0].nombres
                    },
                    "ordenCompraDetalles": detalles.map(item => {
                        return {
                            "id": item.id,
                            "cantidad": item.cantidad,
                            "costo": item.costo,
                            "producto": {
                                "codigo": item.codigo,
                                "nombre": item.nombre,
                                "imagen": bucket && item.imagen  ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : `${process.env.APP_URL}/files/to/default.png`,
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "OrdenCompra/documentsPdfReports", error);
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "OrdenCompra/documentsPdfExcel", error);
        }
    }
}

module.exports = OrdenCompra;