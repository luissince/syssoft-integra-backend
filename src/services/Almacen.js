const Conexion = require('../database/Conexion');
const { currentDate, currentTime, generateAlphanumericCode, generateNumericCode } = require('../tools/Tools');
const conec = new Conexion();

class Almacen {

    async list(req) {
        try {
            const lista = await conec.query(`SELECT 
                a.idAlmacen,
                a.nombre,
                a.direccion,       
                u.departamento,
                u.distrito,
                u.provincia,
                a.codigoSunat
                FROM almacen AS a
                INNER JOIN ubigeo AS u ON a.idUbigeo = u.idUbigeo 
                WHERE
                ? = 0 AND a.idSucursal = ?
                OR
                ? = 1 AND a.nombre LIKE CONCAT(?,'%') AND a.idSucursal = ?
                ORDER BY a.fecha ASC, a.hora ASC
                LIMIT ?,?;`, [
                parseInt(req.query.opcion),
                req.query.idSucursal,

                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            })

            const total = await conec.query(`SELECT COUNT(*) AS Total
                FROM almacen AS a
                INNER JOIN ubigeo AS u ON a.idUbigeo = u.idUbigeo 
                WHERE
                ? = 0 AND a.idSucursal = ?
                OR
                ? = 1 AND a.nombre LIKE CONCAT(?,'%') AND a.idSucursal = ?`, [
                parseInt(req.query.opcion),
                req.query.idSucursal,

                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.idSucursal,
            ]);

            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async add(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const result = await conec.execute(connection, 'SELECT idAlmacen FROM almacen');
            const idAlmacen = generateAlphanumericCode("AM0001", result, 'idAlmacen');

            await conec.execute(connection, `INSERT INTO almacen(
                idAlmacen, 
                idSucursal,
                nombre,
                direccion,
                idUbigeo,
                codigoSunat,
                observacion,  
                predefinido,              
                idUsuario,
                fecha,
                hora)
                VALUES(?,?,?,?,?,?,?,0,?,?,?)`, [
                idAlmacen,
                req.body.idSucursal,
                req.body.nombre,
                req.body.direccion,
                req.body.idUbigeo,
                req.body.codigoSunat,
                req.body.observacion,
                req.body.idUsuario,
                currentDate(),
                currentTime()
            ])

            const listaInventarios = await conec.execute(connection, 'SELECT idInventario FROM inventario');
            let idInventario = generateNumericCode(1, listaInventarios, 'idInventario');

            const productos = await conec.execute(connection, "SELECT * FROM producto WHERE idTipoProducto = 'TP0001' OR idTipoProducto = 'TP0004'");

            for (const producto of productos) {
                await conec.execute(connection, `INSERT INTO inventario(
                    idInventario, 
                    idProducto,
                    idAlmacen,
                    cantidad, 
                    cantidadMaxima, 
                    cantidadMinima
                ) VALUES(?,?,?,?,?,?)`, [
                    idInventario,
                    producto.idProducto,
                    idAlmacen,
                    0,
                    0,
                    0
                ])

                idInventario++;
            }

            await conec.commit(connection);
            return "insert";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }

            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async id(req) {
        try {
            const result = await conec.query(`SELECT 
            a.idAlmacen,
            a.nombre,
            a.direccion,       
            u.idUbigeo,
            u.departamento,
            u.distrito,
            u.provincia,
            u.ubigeo,
            a.codigoSunat,
            a.observacion
            FROM almacen AS a
            INNER JOIN ubigeo AS u ON a.idUbigeo = u.idUbigeo 
            where a.idAlmacen = ?`, [
                req.query.idAlmacen
            ]);
            return result[0];
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async update(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            await conec.execute(connection, `UPDATE almacen                  
                set nombre = ?,
                direccion = ?,
                idUbigeo = ?,
                codigoSunat = ?,
                observacion = ?,
                idUsuario = ?
                where idAlmacen = ?`, [
                req.body.nombre,
                req.body.direccion,
                req.body.idUbigeo,
                req.body.codigoSunat,
                req.body.observacion,
                req.body.idUsuario,
                req.body.idAlmacen
            ])

            await conec.commit(connection);
            return "updated";
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

            const predefinido = await conec.execute(connection, `SELECT * FROM inventario WHERE idAlmacen = ? AND predefinido = ?`);
            if(predefinido.length !== 0){
                await conec.rollback(connection);

                return "El almacen esta como predefinido no puede ser eliminado.";
            }

            const inventario = await conec.execute(connection, `SELECT * FROM inventario WHERE idAlmacen = ?`,[
                req.body.idAlmacen
            ])

            if(inventario.length !== 0){
                await conec.rollback(connection);

                return "Hay un inventario ligado por ello no se puede eliminar el almacen.";
            }

            await conec.execute(connection, `DELETE FROM almacen
                where idAlmacen = ?`, [
                req.body.idAlmacen
            ])

            await conec.commit(connection);

            return "deleted";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }

            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async combo(req) {
        try {
            const lista = await conec.query(`SELECT idAlmacen, nombre FROM almacen`);
            return lista;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }
}

module.exports = Almacen;