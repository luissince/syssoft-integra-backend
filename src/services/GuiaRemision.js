const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode } = require('../tools/Tools');
const Conexion = require('../database/Conexion');
const { sendSuccess, sendError, sendSave } = require('../tools/Message');
const { default: axios } = require('axios');
const FirebaseService = require('../tools/FiraseBaseService');
const conec = new Conexion();
const firebaseService = new FirebaseService();

class GuiaRemision {

    async list(req, res) {
        try {
            const lista = await conec.procedure(`CALL Listar_Guia_Remision(?,?,?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,
                req.query.fechaInicio,
                req.query.fechaFinal,
                parseInt(req.query.estado),

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_Guia_Remision_Count(?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,
                req.query.fechaInicio,
                req.query.fechaFinal,
                parseInt(req.query.estado),
            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "GuiaRemision/list", error)
        }
    }

    async id(req, res) {
        try {
            const ajuste = await conec.query(`
            SELECT 
                a.idAjuste,
                DATE_FORMAT(a.fecha,'%d/%m/%Y') AS fecha,
                a.hora,
                tp.nombre AS tipo,
                mt.nombre AS motivo,
                al.nombre AS almacen,
                a.observacion,
                a.estado
            FROM 
                ajuste AS a 
            INNER JOIN 
                tipoAjuste as tp ON tp.idTipoAjuste = a.idTipoAjuste
            INNER JOIN 
                motivoAjuste as mt on mt.idMotivoAjuste = a.idMotivoAjuste
            INNER JOIN 
                almacen as al on al.idAlmacen = a.idAlmacen
            INNER JOIN 
                usuario us on us.idUsuario = a.idUsuario
            WHERE 
                a.idAjuste = ?`, [
                req.query.idAjuste,
            ])

            const detalle = await conec.query(`
            SELECT 
                p.codigo,
                p.nombre as producto,
                aj.cantidad,
                m.nombre as unidad,
                c.nombre as categoria
            FROM 
                ajusteDetalle AS aj
            INNER JOIN 
                producto as p on p.idProducto = aj.idProducto
            INNER JOIN 
                medida as m on m.idMedida = p.idMedida
            INNER JOIN 
                categoria as c on c.idCategoria = p.idCategoria
            WHERE 
                aj.idAjuste = ?`, [
                req.query.idAjuste,
            ])

            return sendSuccess(res, { cabecera: ajuste[0], detalle });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "GuiaRemision/id", error)
        }
    }

    async detail(req, res) {
        try {
            const guiaRemision = await conec.procedure(`CALL Guia_Remision_Por_Id(?)`, [
                req.query.idGuiaRemision,
            ]);

            const detalles = await conec.procedure(`CALL Guia_Remision_Detalle_Por_Id(?)`, [
                req.query.idGuiaRemision,
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

            return sendSuccess(res, { cabecera: guiaRemision[0], detalles: listaDetalles });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "GuiaRemision/detail", error)
        }
    }

    async detailUpdate(req, res) {
        try {
            const guiaRemision = await conec.query(`
            SELECT
                v.idVenta,
                cv.nombre AS nombreComprobante,
                v.serie,
                v.numeracion,
                cl.documento,
                cl.informacion,
                gui.idModalidadTraslado,
                gui.idMotivoTraslado,
                DATE_FORMAT(gui.fechaTraslado,'%Y-%m-%d') AS fechaTraslado,
                gui.idTipoPeso,
                gui.peso,
                gui.idVehiculo,
                vh.marca,
                vh.numeroPlaca,
                gui.idConductor,
                cd.documento AS documentoCoductor,
                cd.informacion AS informacionConductor,
                gui.direccionPartida,
                gui.direccionLlegada,                
                up.idUbigeo AS idUbigeopPartida,
                up.departamento AS departamentoPartida,
                up.provincia AS provinciaPartida,
                up.distrito AS distritoPartida,
                up.ubigeo AS ubigeoPartida,
                ul.idUbigeo AS idUbigeoLlegada,
                ul.departamento AS departamentoLlegada,
                ul.provincia AS provinciaLlegada,
                ul.distrito AS distritoLlegada,
                ul.ubigeo AS ubigeoLlegada
            FROM
                guiaRemision AS gui
            INNER JOIN 
                venta AS v ON v.idVenta = gui.idVenta
            INNER JOIN 
                comprobante AS cv on cv.idComprobante = v.idComprobante
            INNER JOIN 
                persona AS cl ON cl.idPersona = v.idCliente
            INNER JOIN 
                vehiculo AS vh ON vh.idVehiculo = gui.idVehiculo
            INNER JOIN 
                persona AS cd ON cd.idPersona = gui.idConductor
            INNER JOIN 
                ubigeo AS up ON up.idUbigeo = gui.idUbigeoPartida
            INNER JOIN 
                ubigeo AS ul ON ul.idUbigeo = gui.idUbigeoLlegada
            WHERE  
                gui.idGuiaRemision = ?`, [
                req.query.idGuiaRemision,
            ]);

            return sendSuccess(res, { cabecera: guiaRemision[0] });
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "GuiaRemision/detailUpdate", error)
        }
    }

    async create(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const {
                idVenta,
                idSucursal,
                idComprobante,
                idModalidadTraslado,
                idMotivoTraslado,
                fechaTraslado,
                idTipoPeso,
                peso,
                idVehiculo,
                idConductor,
                direccionPartida,
                idUbigeoPartida,
                direccionLlegada,
                idUbigeoLlegada,
                estado,
                idUsuario,
                detalle
            } = req.body;

            const result = await conec.execute(connection, 'SELECT idGuiaRemision FROM guiaRemision');
            const idGuiaRemision = generateAlphanumericCode("GR0001", result, 'idGuiaRemision');

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

            const guiaRemisions = await conec.execute(connection, `
            SELECT 
                numeracion  
            FROM 
                guiaRemision 
            WHERE 
                idComprobante = ?`, [
                idComprobante
            ]);

            const numeracion = generateNumericCode(comprobante[0].numeracion, guiaRemisions, "numeracion");

            await conec.execute(connection, `INSERT INTO guiaRemision(
                idGuiaRemision,
                idSucursal,
                idVenta,                
                idComprobante,
                serie,
                numeracion,
                idModalidadTraslado,
                idMotivoTraslado,
                fechaTraslado,
                idTipoPeso,
                peso,
                idVehiculo,
                idConductor,
                direccionPartida,
                idUbigeoPartida,
                direccionLlegada,
                idUbigeoLlegada,
                fecha,
                hora,
                estado,
                idUsuario
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idGuiaRemision,
                idSucursal,
                idVenta,
                idComprobante,
                comprobante[0].serie,
                numeracion,
                idModalidadTraslado,
                idMotivoTraslado,
                fechaTraslado,
                idTipoPeso,
                peso,
                idVehiculo,
                idConductor,
                direccionPartida,
                idUbigeoPartida,
                direccionLlegada,
                idUbigeoLlegada,
                currentDate(),
                currentTime(),
                estado,
                idUsuario
            ]);

            const listaGuiaRemision = await conec.execute(connection, 'SELECT idGuiaRemisionDetalle FROM guiaRemisionDetalle');
            let idGuiaRemisionDetalle = generateNumericCode(1, listaGuiaRemision, 'idGuiaRemisionDetalle');

            for (const producto of detalle) {
                await conec.execute(connection, `
                INSERT INTO guiaRemisionDetalle(
                    idGuiaRemisionDetalle,
                    idGuiaRemision,
                    idProducto,
                    cantidad
                ) VALUES (?,?,?,?)`, [
                    idGuiaRemisionDetalle,
                    idGuiaRemision,
                    producto.idProducto,
                    producto.cantidad
                ]);

                idGuiaRemisionDetalle++;
            }

            await conec.commit(connection);
            return sendSave(res,{
                message: "Se registró correctamente la guían de remisión.",
                idGuiaRemision: idGuiaRemision
            });
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "GuiaRemision/create", error)
        }
    }

    async update(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            await conec.execute(connection, `
                UPDATE 
                    guiaRemision 
                SET
                    idVenta = ?,
                    idModalidadTraslado = ?,
                    idMotivoTraslado = ?,
                    fechaTraslado = ?,
                    idTipoPeso = ?,
                    peso = ?,
                    idVehiculo = ?,
                    idConductor = ?,
                    direccionPartida = ?,
                    idUbigeoPartida = ?,
                    direccionLlegada = ?,
                    idUbigeoLlegada = ?,
                    numeroTicketSunat = '',
                    idUsuario = ?
                WHERE
                    idGuiaRemision = ?`, [
                req.body.idVenta,
                req.body.idModalidadTraslado,
                req.body.idMotivoTraslado,
                req.body.fechaTraslado,
                req.body.idTipoPeso,
                req.body.peso,
                req.body.idVehiculo,
                req.body.idConductor,
                req.body.direccionPartida,
                req.body.idUbigeoPartida,
                req.body.direccionLlegada,
                req.body.idUbigeoLlegada,
                // currentDate(),
                // currentTime(),
                req.body.idUsuario,
                req.body.idGuiaRemision
            ]);

            await conec.execute(connection, `
            DELETE FROM 
                guiaRemisionDetalle 
            WHERE 
                idGuiaRemision = ?`, [
                req.body.idGuiaRemision
            ]);

            const listaGuiaRemision = await conec.execute(connection, 'SELECT idGuiaRemisionDetalle FROM guiaRemisionDetalle');
            let idGuiaRemisionDetalle = generateNumericCode(1, listaGuiaRemision, 'idGuiaRemisionDetalle');

            for (const producto of req.body.detalle) {
                await conec.execute(connection, `
                INSERT INTO guiaRemisionDetalle(
                    idGuiaRemisionDetalle,
                    idGuiaRemision,
                    idProducto,
                    cantidad
                ) VALUES (?,?,?,?)`, [
                    idGuiaRemisionDetalle,
                    req.body.idGuiaRemision,
                    producto.idProducto,
                    producto.cantidad
                ]);

                idGuiaRemisionDetalle++;
            }

            await conec.commit(connection);
            return sendSave(res,{
                message: "Se actualizón correctamente la guían de remisión.",
                idGuiaRemision: req.body.idGuiaRemision
            });
        } catch (error) {
            console.log(error)
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "GuiaRemision/update", error)
        }
    }

    async cancel(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();



            await conec.commit(connection);
            return sendSave(res, "Se anuló correctamente la guían de remisión.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "GuiaRemision/cancel", error)
        }
    }

    async documentsPdfInvoices(req, res) {
        try {
            const { idGuiaRemision, size } = req.params;

            const empresa = await conec.query(`
            SELECT
                documento,
                razonSocial,
                nombreEmpresa,
                rutaLogo,
                tipoEnvio
            FROM 
                empresa`);

            const guiaRemision = await conec.query(`
            SELECT
                DATE_FORMAT(gui.fecha,'%d/%m/%Y') AS fecha,
                gui.hora,
                gui.idSucursal,
                --
                cgui.nombre AS comprobante,
                gui.serie,
                gui.numeracion,
                cgui.facturado,
                --
                mdt.nombre AS modalidadTraslado,
                --
                mvt.nombre AS motivoTraslado,
                --
                DATE_FORMAT(gui.fechaTraslado,'%d/%m/%Y') AS fechaTraslado,
                --
                tp.nombre AS tipoPeso,
                --
                gui.peso,
                --
                vh.marca,
                vh.numeroPlaca,
                --
                cd.documento AS documentoConductor,
                cd.informacion AS informacionConductor,
                cd.licenciaConducir,
                --
                gui.direccionPartida,
                --
                up.departamento AS departamentoPartida,
                up.provincia AS provinciaPartida,
                up.distrito AS distritoPartida,
                up.ubigeo AS ubigeoPartida,
                --
                gui.direccionLlegada,
                --
                ul.departamento AS departamentoLlegada,
                ul.provincia AS provinciaLlegada,
                ul.distrito AS distritoLlegada,
                ul.ubigeo AS ubigeoLlegada,
                --
                u.apellidos,
                u.nombres,
                --
                v.serie AS serieRef,
                v.numeracion AS numeracionRef,
                cv.nombre AS comprobanteRef,
                --
                cl.documento AS documentoCliente,
                cl.informacion AS informacionCliente,
                --
                gui.codigoHash
            FROM
                guiaRemision AS gui
            INNER JOIN 
                comprobante AS cgui on cgui.idComprobante = gui.idComprobante
            INNER JOIN 
                modalidadTraslado AS mdt ON mdt.idModalidadTraslado = gui.idModalidadTraslado
            INNER JOIN 
                motivoTraslado AS mvt ON mvt.idMotivoTraslado = gui.idMotivoTraslado
            INNER JOIN 
                tipoPeso AS tp ON tp.idTipoPeso = gui.idTipoPeso
            INNER JOIN 
                vehiculo AS vh ON vh.idVehiculo = gui.idVehiculo
            INNER JOIN 
                persona AS cd ON cd.idPersona = gui.idConductor
            INNER JOIN 
                ubigeo AS up ON up.idUbigeo = gui.idUbigeoPartida
            INNER JOIN 
                ubigeo AS ul ON ul.idUbigeo = gui.idUbigeoLlegada
            INNER JOIN 
                usuario AS u ON u.idUsuario = gui.idUsuario
            INNER JOIN 
                venta AS v ON v.idVenta = gui.idVenta
            INNER JOIN 
                comprobante AS cv on cv.idComprobante = v.idComprobante
            INNER JOIN 
                persona AS cl ON cl.idPersona = v.idCliente
            WHERE 
                gui.idGuiaRemision = ?`, [
                idGuiaRemision
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
                guiaRemision[0].idSucursal
            ]);

            const detalles = await conec.query(` 
            SELECT 
                ROW_NUMBER() OVER (ORDER BY gd.idGuiaRemisionDetalle ASC) AS id,
                p.codigo,
                p.nombre AS producto,
                gd.cantidad,
                m.nombre AS medida 
            FROM 
                guiaRemisionDetalle AS gd
            INNER JOIN 
                producto AS p ON gd.idProducto = p.idProducto
            INNER JOIN 
                medida AS m ON m.idMedida = p.idMedida
            WHERE 
                gd.idGuiaRemision = ?
            ORDER BY 
                gd.idGuiaRemisionDetalle ASC`, [
                idGuiaRemision
            ]);

            return {
                "size": size,
                "company": {
                    ...empresa[0],
                    rutaLogo: empresa[0].rutaLogo ? `${process.env.APP_URL}/files/company/${empresa[0].rutaLogo}` : null,
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
                "dispatchGuide": {
                    "fecha": guiaRemision[0].fecha,
                    "hora": guiaRemision[0].hora,
                    "comprobante": {
                        "nombre": guiaRemision[0].comprobante,
                        "serie": guiaRemision[0].serie,
                        "numeracion": guiaRemision[0].numeracion,
                        "facturado": guiaRemision[0].facturado
                    },
                    "modalidadTraslado": {
                        "nombre": guiaRemision[0].modalidadTraslado
                    },
                    "motivoTraslado": {
                        "nombre": guiaRemision[0].motivoTraslado
                    },
                    "fechaTraslado": guiaRemision[0].fechaTraslado,
                    "tipoPeso": {
                        "nombre": guiaRemision[0].tipoPeso,
                    },
                    "peso": guiaRemision[0].peso,
                    "vehiculo": {
                        "marca": guiaRemision[0].marca,
                        "numeroPlaca": guiaRemision[0].numeroPlaca,
                    },
                    "conductor": {
                        "documento": guiaRemision[0].documentoConductor,
                        "informacion": guiaRemision[0].informacionConductor,
                        "licenciaConducir": guiaRemision[0].licenciaConducir
                    },
                    "direccionPartida": guiaRemision[0].direccionPartida,
                    "ubigeoPartida": {
                        "departamento": guiaRemision[0].departamentoPartida,
                        "provincia": guiaRemision[0].provinciaPartida,
                        "distrito": guiaRemision[0].distritoPartida,
                        "ubigeo": guiaRemision[0].ubigeoPartida,
                    },
                    "direccionLlegada": guiaRemision[0].direccionLlegada,
                    "ubigeoLlegada": {
                        "departamento": guiaRemision[0].departamentoLlegada,
                        "provincia": guiaRemision[0].provinciaLlegada,
                        "distrito": guiaRemision[0].distritoLlegada,
                        "ubigeo": guiaRemision[0].ubigeoLlegada,
                    },
                    "usuario": {
                        "apellidos": guiaRemision[0].apellidos,
                        "nombres": guiaRemision[0].nombres
                    },
                    "venta": {
                        "comprobante": {
                            "nombre": guiaRemision[0].comprobanteRef,
                            "serie": guiaRemision[0].serieRef,
                            "numeracion": guiaRemision[0].numeracionRef,
                        },
                        "cliente": {
                            "documento": guiaRemision[0].documentoCliente,
                            "informacion": guiaRemision[0].informacionCliente,
                        }
                    },
                    "codigoHash": guiaRemision[0].codigoHash,
                    "guiaRemisionDetalles": detalles.map(item => {
                        return {
                            "id": item.id,
                            "cantidad": item.cantidad,
                            "producto": {
                                "codigo": item.codigo,
                                "nombre": item.producto,
                                "medida": {
                                    "nombre": item.medida,
                                },
                            },
                        }
                    }),
                },
            };
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async documentsPdfReports(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/dispatch-guide/pdf/reports`,
                headers: {
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendFile(res, response);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "GuiaRemision/documentsPdfReports", error);
        }
    }

    async documentsPdfExcel(req, res) {
        try {
            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/dispatch-guide/excel`,
                headers: {
                    'Content-Type': 'application/json',
                },                
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            return sendSuccess(res, response.data);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "GuiaRemision/documentsPdfExcel", error);
        }
    }
}

module.exports = GuiaRemision;