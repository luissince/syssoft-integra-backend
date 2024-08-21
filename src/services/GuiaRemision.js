const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode } = require('../tools/Tools');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class GuiaRemision {

    async list(req) {
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

            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async id(req) {
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

            return { cabecera: ajuste[0], detalle };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async detail(req) {
        try {
            const guiaRemision = await conec.procedure(`CALL Guia_Remision_Por_Id(?)`, [
                req.query.idGuiaRemision,
            ])

            const detalle = await conec.procedure(`CALL Guia_Remision_Detalle_Por_Id(?)`, [
                req.query.idGuiaRemision,
            ])

            return { cabecera: guiaRemision[0], detalle };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async detailUpdate(req) {
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

            return { cabecera: guiaRemision[0] };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async create(req) {
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
            return {
                message: "Se registró correctamente la guían de remisión.",
                idGuiaRemision: idGuiaRemision
            };
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async update(req) {
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
            return "update";
        } catch (error) {
            console.log(error)
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async cancel(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            await conec.commit(connection);
            return "cancel";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }
}

module.exports = GuiaRemision;