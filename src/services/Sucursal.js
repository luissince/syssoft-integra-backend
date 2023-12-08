const {
    currentDate,
    currentTime,
    isDirectory,
    removeFile,
    writeFile,
    mkdir,
    chmod,
    generateAlphanumericCode,
} = require('../tools/Tools');
const path = require("path");
const { sendSuccess, sendSave, sendClient, sendError } = require('../tools/Message');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Sucursal {

    async list(req, res) {
        try {
            const lista = await conec.query(`SELECT  
            p.idSucursal,
            p.nombre,
            p.direccion,
            p.estado
            FROM sucursal AS p
            WHERE 
            ? = 0
            OR
            ? = 1 AND p.nombre LIKE concat(?,'%')
            LIMIT ?,?`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar,

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.query(`SELECT COUNT(*) AS Total 
            FROM sucursal AS p
            WHERE 
            ? = 0
            OR
            ? = 1 AND p.nombre LIKE concat(?,'%')`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar,

            ]);

            return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
        } catch (error) {
            console.log(error)
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async add(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const resultSucursal = await conec.execute(connection, 'SELECT idSucursal FROM sucursal');
            const idSucursal = generateAlphanumericCode("SC0001", resultSucursal, 'idSucursal');
            console.log(idSucursal)

            const file = path.join(__dirname, '../', 'path/proyect');

            if (!isDirectory(file)) {
                mkdir(file);
                chmod(file);
            }

            const fileImage = "";
            if (req.body.imagen !== "") {
                let nameImage = `${Date.now() + idSucursal}.${req.body.extension}`;

                writeFile(path.join(file, nameImage), req.body.imagen);
                fileImage = nameImage;
            }

            await conec.execute(connection, `INSERT INTO sucursal(
                    idSucursal,
                    nombre, 
                    direccion,
                    idUbigeo,
                    imagen,
                    extension,
                    ruta,
                    estado,
                    fecha,
                    hora,
                    fupdate,
                    hupdate,
                    idUsuario
                )VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idSucursal,
                //datos
                req.body.nombre,
                req.body.direccion,
                req.body.idUbigeo,
                //imagen
                req.body.imagen,
                req.body.extension,
                '',
                req.body.estado,
                currentDate(),
                currentTime(),
                currentDate(),
                currentTime(),
                req.body.idUsuario,
            ])

            await conec.commit(connection);
            return sendSave(res, "Se registró correctamente el sucursal.");
        } catch (error) {
            console.log(error)
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async id(req, res) {
        try {
            let result = await conec.query(`SELECT 
            p.idSucursal,
            p.nombre,
            p.estado,
            p.direccion,

            p.idUbigeo,
            u.ubigeo,
            u.departamento,
            u.provincia,
            u.distrito,

            p.ruta
            FROM sucursal AS p
            INNER JOIN ubigeo AS u ON u.idUbigeo = p.idUbigeo
            WHERE p.idSucursal = ?`, [
                req.query.idSucursal,
            ]);

            if (result.length > 0) {
                return sendSuccess(res, result[0]);
            } else {
                return sendClient(res, "Datos no encontrados");
            }
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async edit(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const file = path.join(__dirname, '../', 'path/proyect');

            if (!isDirectory(file)) {
                mkdir(file);
                chmod(file);
            }

            const sucursal = await conec.execute(connection, `SELECT
            imagen,
            extension,
            ruta
            FROM sucursal
            WHERE idSucursal = ?`, [
                req.body.idSucursal
            ]);

            let imagen = "";
            let extension = "";
            let ruta = "";

            if (req.body.imagen !== "") {
                removeFile(path.join(file, sucursal[0].ruta));

                const nameImage = `${Date.now() + req.body.idSucursal}.${req.body.extension}`;
                writeFile(path.join(file, nameImage), req.body.imagen);
                imagen = req.body.imagen;
                extension = req.body.extension;
                ruta = nameImage;
            } else {
                imagen = sucursal[0].imagen;
                extension = sucursal[0].extension;
                ruta = sucursal[0].ruta;
            }

            await conec.execute(connection, `UPDATE sucursal SET
                nombre = ?,
                direccion = ?,
                idUbigeo = ?,
                estado = ?,
                imagen = ?,
                extension = ?,
                ruta = ?,            
                fupdate = ?,
                hupdate = ? ,
                idUsuario = ?
                WHERE idSucursal=?`, [
                req.body.nombre,
                req.body.direccion,
                req.body.idUbigeo,
                req.body.estado,
                imagen,
                extension,
                ruta,
                currentDate(),
                currentTime(),
                req.body.idUsuario,
                req.body.idSucursal
            ])

            await conec.commit(connection)
            return sendSave(res, 'Se actualizó correctamente el sucursal.');
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async delete(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            let sucursal = await conec.execute(connection, `SELECT ruta FROM sucursal WHERE idSucursal = ?`, [
                req.query.idSucursal
            ]);

            if (sucursal.length == 0) {
                await conec.rollback(connection);
                return sendClient(res, "El sucursal a eliminar no existe, recargue su pantalla.");
            }

            let cobro = await conec.execute(connection, `SELECT idCobro FROM cobro WHERE idSucursal = ?`, [
                req.query.idSucursal
            ]);

            if (cobro.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el sucursal ya que esta ligada a unos cobros.');
            }

            let gasto = await conec.execute(connection, `SELECT idGasto FROM gasto WHERE idSucursal = ?`, [
                req.query.idSucursal
            ]);

            if (gasto.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el sucursal ya que esta ligada a unos gastos.');
            }

            let venta = await conec.execute(connection, `SELECT idVenta  FROM venta WHERE idSucursal = ?`, [
                req.query.idSucursal
            ]);

            if (venta.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el sucursal ya que esta ligada a unas ventas.');
            }

            let file = path.join(__dirname, '../', 'path/proyect');
            removeFile(path.join(file, sucursal[0].ruta));

            await conec.execute(connection, `DELETE FROM sucursal WHERE idSucursal = ?`, [
                req.query.idSucursal
            ]);

            await conec.commit(connection);
            return sendSave(res, "Se eliminó correctamente el sucursal.");
        } catch (error) {
            console.log(error)
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async inicio(req, res) {
        try {
            const sucursales = await conec.query(`SELECT 
            p.idSucursal,
            p.nombre,
            p.direccion,
            p.ruta,
            p.estado
            FROM sucursal AS p          
            `);

            return sendSuccess(res, sucursales);
        } catch (error) {
            console.log(error)
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

    async combo(req, res) {
        try {
            const sucursales = await conec.query(`SELECT idSucursal,nombre FROM sucursal`)
            return sendSuccess(res, sucursales);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.");
        }
    }

}

module.exports = new Sucursal();