const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode } = require('../tools/Tools');
const conec = require('../database/mysql-connection');
const firebaseService = require('../common/fire-base');
const { AJUSTE_TYPES, KARDEX_TYPES, KARDEX_MOTIVOS } = require('../config/constants');
const { ClientError } = require('../tools/Error');

class AjusteService {

    async list(data) {
        const {
            opcion,
            buscar,
            idSucursal,
            fechaInicio,
            fechaFinal,
            idTipoAjuste,
            posicionPagina,
            filasPorPagina
        } = data;

        const lista = await conec.procedure(`CALL Listar_Ajuste(?,?,?,?,?,?,?,?)`, [
            parseInt(opcion),
            buscar,
            idSucursal,
            fechaInicio,
            fechaFinal,
            idTipoAjuste,
            parseInt(posicionPagina),
            parseInt(filasPorPagina)
        ]);

        const resultLista = lista.map(function (item, index) {
            return {
                ...item,
                id: (index + 1) + parseInt(posicionPagina)
            }
        });

        const total = await conec.procedure(`CALL Listar_Ajuste_Count(?,?,?,?,?,?)`, [
            parseInt(opcion),
            buscar,
            idSucursal,
            fechaInicio,
            fechaFinal,
            idTipoAjuste,
        ]);

        return { "result": resultLista, "total": total[0].Total };
    }

    async detail(idAjuste) {
        const ajuste = await conec.query(`
            SELECT 
                a.idAjuste,
                DATE_FORMAT(a.fecha,'%d/%m/%Y') as fecha,
                a.hora,
                tp.nombre as tipo,
                mt.nombre as motivo,
                al.nombre as almacen,
                a.observacion,
                a.estado
            FROM 
                ajuste as a 
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
            idAjuste,
        ]);

        const detalles = await conec.query(`
            SELECT 
                p.codigo,
                p.nombre as producto,
                p.imagen,
                aj.cantidad,
                m.nombre as unidad,
                c.nombre as categoria
            FROM 
                ajusteDetalle as aj
            INNER JOIN 
                producto as p on p.idProducto = aj.idProducto
            INNER JOIN 
                medida as m on m.idMedida = p.idMedida
            INNER JOIN 
                categoria as c on c.idCategoria = p.idCategoria
            WHERE 
                aj.idAjuste = ?`, [
            idAjuste,
        ]);

        const bucket = firebaseService.getBucket();
        const listaDetalles = detalles.map((item, index) => {
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

        return { cabecera: ajuste[0], detalles: listaDetalles };
    }

    async create(body) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const {
                idTipoAjuste,
                idMotivoAjuste,
                idAlmacen,
                idSucursal,
                observacion,
                idUsuario,
                detalles
            } = body;

            const date = currentDate();
            const time = currentTime();

            const result = await conec.execute(connection, "SELECT idAjuste FROM ajuste");
            const idAjuste = generateAlphanumericCode("AJ0001", result, 'idAjuste');

            await conec.execute(connection, `
            INSERT INTO ajuste(
                idAjuste, 
                idTipoAjuste, 
                idMotivoAjuste, 
                idAlmacen, 
                idSucursal, 
                observacion, 
                fecha, 
                hora, 
                idUsuario
            ) VALUES(?,?,?,?,?,?,?,?,?)`, [
                idAjuste,
                idTipoAjuste,
                idMotivoAjuste,
                idAlmacen,
                idSucursal,
                observacion,
                date,
                time,
                idUsuario
            ]);

            const ajusteDetalleIds = await conec.execute(connection, "SELECT idAjusteDetalle FROM ajusteDetalle");
            let idAjusteDetalle = generateNumericCode(1, ajusteDetalleIds, "idAjusteDetalle");

            const kardexIds = await conec.execute(connection, "SELECT idKardex FROM kardex");
            let idKardex = kardexIds.length ? Math.max(...kardexIds.map(item => parseInt(item.idKardex.replace("KD", '')))) : 0;

            const generarIdKardex = () => `KD${String(++idKardex).padStart(4, '0')}`;

            const tipoKardex = idTipoAjuste === AJUSTE_TYPES.INCREMENTO ? KARDEX_TYPES.INGRESO : KARDEX_TYPES.SALIDA;
            const motivoKardex = KARDEX_MOTIVOS.AJUSTE;
            const detalleKardex = idTipoAjuste === AJUSTE_TYPES.INCREMENTO ? "INGRESO POR AJUSTE" : "SALIDA POR AJUSTE";

            for (const detalle of detalles) {
                console.log(detalle);
                // Obtener la cantidad
                const cantidad = detalle.inventarioDetalles.reduce((acum, item) => acum + Number(item.cantidadAjustar), 0);

                // Ingresar datos al detalle
                await conec.execute(connection, `
                INSERT INTO ajusteDetalle(
                    idAjusteDetalle, 
                    idAjuste, 
                    idProducto, 
                    cantidad
                ) VALUES(?,?,?,?)`, [
                    idAjusteDetalle,
                    idAjuste,
                    detalle.idProducto,
                    cantidad
                ]);

                idAjusteDetalle++;

                const [{ costo }] = await conec.execute(connection, `
                SELECT 
                    costo 
                FROM 
                    producto 
                WHERE 
                    idProducto = ?`, [
                    detalle.idProducto
                ]);

                for (const inventarioDetalle of detalle.inventarioDetalles) {
                    const cantidadAjustar = Number(inventarioDetalle.cantidadAjustar);

                    await conec.execute(connection, `
                    INSERT INTO kardex(
                        idKardex, 
                        idProducto, 
                        idTipoKardex, 
                        idMotivoKardex, 
                        idAjuste,
                        detalle, 
                        cantidad, 
                        costo, 
                        idAlmacen, 
                        lote,
                        idUbicacion,
                        fechaVencimiento,
                        fecha, 
                        hora, 
                        idUsuario
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                        generarIdKardex(),
                        detalle.idProducto,
                        tipoKardex,
                        motivoKardex,
                        idAjuste,
                        detalleKardex,
                        cantidadAjustar,
                        costo,
                        idAlmacen,
                        inventarioDetalle.lote,
                        inventarioDetalle.idUbicacion,
                        inventarioDetalle.fechaVencimiento,
                        date,
                        time,
                        idUsuario
                    ]);
                }
            }

            await conec.commit(connection);
            return "Se registró correctamente el ajuste.";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }

            throw error;
        }
    }

    async cancel(data) {
        let connection = null;
        try {
            const { idAjuste, idUsuario } = data;

            // Inicia una transacción de la base de datos
            connection = await conec.beginTransaction();

            const date = currentDate();
            const time = currentTime();

            // Obtener ajuste
            const [ajuste] = await conec.execute(connection, `
            SELECT 
                idTipoAjuste, 
                idAlmacen, 
                estado 
            FROM 
                ajuste 
            WHERE 
                idAjuste = ?`, [
                idAjuste
            ]);

            if (!ajuste) {
                throw new ClientError("El ajuste no existe, verifique el código o actualiza la lista.");
            }

            if (ajuste.estado === 0) {
                throw new ClientError("El ajuste ya se encuentra con estado cancelado.");
            }

            // Cancelar ajuste
            await conec.execute(connection, `
            UPDATE 
                ajuste 
            SET 
                estado = 0 
            WHERE 
                idAjuste = ?`, [
                idAjuste
            ]);


            // Obtener detalles del ajuste
            const ajusteDetalles = await conec.execute(connection, `
            SELECT 
                idProducto, 
                cantidad 
            FROM 
                ajusteDetalle
            WHERE 
                idAjuste = ?`, [
                idAjuste
            ]);

            // Obtener ID kardex siguiente
            const resultKardex = await conec.execute(connection, "SELECT idKardex FROM kardex");
            let idKardex = resultKardex.length ? Math.max(...resultKardex.map(k => parseInt(k.idKardex.replace("KD", '')))) : 0;

            const generarIdKardex = () => `KD${String(++idKardex).padStart(4, '0')}`;

            // Determinar operación inversa
            const tipoKardex = ajuste.idTipoAjuste === AJUSTE_TYPES.INCREMENTO ? KARDEX_TYPES.SALIDA : KARDEX_TYPES.INGRESO;
            const motivoKardex = KARDEX_MOTIVOS.AJUSTE;
            const detalleKardex = ajuste.idTipoAjuste === AJUSTE_TYPES.INCREMENTO ? "ANULAR AJUSTE DE INGRESO" : "ANULAR AJUSTE DE SALIDA";

            for (const detalle of ajusteDetalles) {
                const kardexes = await conec.execute(connection, `
                SELECT 
                    k.idProducto,
                    k.cantidad,
                    k.costo,
                    k.idAlmacen,
                    k.lote,
                    k.idUbicacion,
                    k.fechaVencimiento
                FROM 
                    kardex AS k 
                WHERE 
                    k.idAjuste = ? AND k.idProducto = ?`, [
                    idAjuste,
                    detalle.idProducto,
                ]);

                for (const kardex of kardexes) {
                    await conec.execute(connection, `
                    INSERT INTO kardex(
                        idKardex, 
                        idProducto, 
                        idTipoKardex, 
                        idMotivoKardex, 
                        idAjuste,
                        detalle, 
                        cantidad, 
                        costo, 
                        idAlmacen, 
                        lote,
                        idUbicacion,
                        fechaVencimiento,
                        fecha, 
                        hora, 
                        idUsuario
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                        generarIdKardex(),
                        detalle.idProducto,
                        tipoKardex,
                        motivoKardex,
                        idAjuste,
                        detalleKardex,
                        kardex.cantidad,
                        kardex.costo,
                        kardex.idAlmacen,
                        kardex.lote,
                        kardex.idUbicacion,
                        kardex.fechaVencimiento,
                        date,
                        time,
                        idUsuario
                    ]);
                }
            }

            await conec.commit(connection);
            return "Se anuló el ajuste correctamente.";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }

            throw error;
        }
    }
}

module.exports = new AjusteService();