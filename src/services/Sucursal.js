const {
    currentDate,
    currentTime,
    isDirectory,
    removeFile,
    mkdir,
    chmod,
    generateAlphanumericCode,
    processImage,
} = require('../tools/Tools');
const path = require("path");
const { sendSuccess, sendSave, sendClient, sendError } = require('../tools/Message');
const Conexion = require('../database/Conexion');
const FirebaseService = require('../tools/FiraseBaseService');
const conec = new Conexion();
const firebaseService = new FirebaseService();

class Sucursal {

    async list(req, res) {
        try {
            const lista = await conec.query(`
            SELECT  
                p.idSucursal,
                p.nombre,
                p.direccion,
                p.estado,
                p.principal,
                p.imagen
            FROM 
                sucursal AS p
            WHERE 
                ? = 0
                OR
                ? = 1 AND p.nombre LIKE concat(?,'%')
            LIMIT 
                ?,?`, [
                parseInt(req.query.opcion),

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
                        id: (index + 1) + parseInt(req.query.posicionPagina)
                    }
                }

                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.query(`
            SELECT 
                COUNT(*) AS Total 
            FROM 
                sucursal AS p
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Sucursal/list", error);
        }
    }

    async add(req, res) {
        let connection = null;
        try {
            const bucket = firebaseService.getBucket();

            connection = await conec.beginTransaction();

            let imagen = null;

            if (req.body.imagen && req.body.imagen.base64 !== undefined) {
                if (bucket) {
                    const buffer = Buffer.from(req.body.imagen.base64, 'base64');

                    const timestamp = Date.now();
                    const uniqueId = Math.random().toString(36).substring(2, 9);
                    const fileName = `branch_${timestamp}_${uniqueId}.${req.body.imagen.extension}`;

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

            // const fileDirectory = path.join(__dirname, '..', 'path', 'proyect');
            // const exists = await isDirectory(fileDirectory);

            // if (!exists) {
            //     await mkdir(fileDirectory);
            //     await chmod(fileDirectory);
            // }

            // const imagen = await processImage(fileDirectory, req.body.image, req.body.extension, null);

            const resultSucursal = await conec.execute(connection, 'SELECT idSucursal FROM sucursal');
            const idSucursal = generateAlphanumericCode("SC0001", resultSucursal, 'idSucursal');

            await conec.execute(connection, `
            INSERT INTO sucursal(
                idSucursal,
                nombre, 
                telefono,
                celular,
                email,
                paginaWeb,
                direccion,
                idUbigeo,
                googleMaps,
                horarioAtencion,
                imagen,
                estado,
                principal,
                fecha,
                hora,
                fupdate,
                hupdate,
                idUsuario
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                idSucursal,
                //datos
                req.body.nombre,
                req.body.telefono,
                req.body.celular,
                req.body.email,
                req.body.paginaWeb,
                req.body.direccion,
                req.body.idUbigeo,
                req.body.googleMaps,
                req.body.horarioAtencion,
                imagen,
                req.body.estado,
                req.body.principal,
                currentDate(),
                currentTime(),
                currentDate(),
                currentTime(),
                req.body.idUsuario,
            ])

            await conec.commit(connection);
            return sendSave(res, "Se registró correctamente el sucursal.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Sucursal/add", error);
        }
    }

    async id(req, res) {
        try {
            const [result] = await conec.query(`
            SELECT 
                p.idSucursal,
                p.nombre,
                IFNULL(p.telefono, '') AS telefono,
                IFNULL(p.celular, '') AS celular,
                IFNULL(p.email, '') AS email,
                IFNULL(p.paginaWeb, '') AS paginaWeb,
                IFNULL(p.direccion, '') AS direccion,
                IFNULL(p.googleMaps, '') AS googleMaps,
                IFNULL(p.horarioAtencion, '') AS horarioAtencion,
                p.imagen,
                p.principal,
                p.estado,
                --
                p.idUbigeo,
                u.ubigeo,
                u.departamento,
                u.provincia,
                u.distrito
                --
            FROM 
                sucursal AS p
            INNER JOIN 
                ubigeo AS u ON u.idUbigeo = p.idUbigeo
            WHERE 
                p.idSucursal = ?`, [
                req.query.idSucursal,
            ]);

            const bucket = firebaseService.getBucket();
            let respuesta = { ...result };
            if (bucket && result.imagen) {
                respuesta = {
                    ...result,
                    imagen: {
                        nombre: result.imagen,
                        url: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${result.imagen}`
                    }
                };
            }

            return sendSuccess(res, respuesta);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Sucursal/id", error);
        }
    }

    async edit(req, res) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const sucursal = await await conec.execute(connection, `
                SELECT 
                    imagen 
                FROM 
                    sucursal 
                WHERE 
                    idSucursal = ?`, [
                req.body.idSucursal
            ]);

            const bucket = firebaseService.getBucket();

            let imagen = null;

            if (req.body.imagen && req.body.imagen.nombre === undefined && req.body.imagen.base64 === undefined) {
                if (bucket) {
                    if (sucursal[0].imagen) {
                        const file = bucket.file(sucursal[0].imagen);
                        await file.delete();
                    }
                }

            } else if (req.body.imagen && req.body.imagen.base64 !== undefined) {
                if (bucket) {
                    if (sucursal[0].imagen) {
                        const file = bucket.file(sucursal[0].imagen);
                        if (file.exists()) {
                            await file.delete();
                        }
                    }

                    const buffer = Buffer.from(req.body.imagen.base64, 'base64');

                    const timestamp = Date.now();
                    const uniqueId = Math.random().toString(36).substring(2, 9);
                    const fileName = `branch_${timestamp}_${uniqueId}.${req.body.imagen.extension}`;

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

            if (req.body.principal === 1) {
                await conec.execute(connection, `UPDATE sucursal SET principal = 0`);
            }

            await conec.execute(connection, `
            UPDATE 
                sucursal 
            SET
                nombre = ?,
                telefono = ?,
                celular = ?,
                email = ?,
                paginaWeb = ?,
                direccion = ?,
                idUbigeo = ?,
                googleMaps = ?,
                horarioAtencion = ?,
                imagen = ?,
                estado = ?,   
                principal = ?,
                fupdate = ?,
                hupdate = ? ,
                idUsuario = ?
            WHERE 
                idSucursal=?`, [
                req.body.nombre,
                req.body.telefono,
                req.body.celular,
                req.body.email,
                req.body.paginaWeb,
                req.body.direccion,
                req.body.idUbigeo,
                req.body.googleMaps,
                req.body.horarioAtencion,
                imagen,
                req.body.estado,
                req.body.principal,
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
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Sucursal/edit", error);
        }
    }

    async delete(req, res) {
        let connection = null;
        try {
            const bucket = firebaseService.getBucket();
            
            connection = await conec.beginTransaction();

            const sucursal = await conec.execute(connection, `SELECT imagen FROM sucursal WHERE idSucursal = ?`, [
                req.query.idSucursal
            ]);

            if (sucursal.length == 0) {
                await conec.rollback(connection);
                return sendClient(res, "El sucursal a eliminar no existe, recargue su pantalla.");
            }

            const cobro = await conec.execute(connection, `SELECT idCobro FROM cobro WHERE idSucursal = ?`, [
                req.query.idSucursal
            ]);

            if (cobro.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el sucursal ya que esta ligada a unos cobros.');
            }

            const gasto = await conec.execute(connection, `SELECT idGasto FROM gasto WHERE idSucursal = ?`, [
                req.query.idSucursal
            ]);

            if (gasto.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el sucursal ya que esta ligada a unos gastos.');
            }

            const venta = await conec.execute(connection, `SELECT idVenta  FROM venta WHERE idSucursal = ?`, [
                req.query.idSucursal
            ]);

            if (venta.length > 0) {
                await conec.rollback(connection);
                return sendClient(res, 'No se puede eliminar el sucursal ya que esta ligada a unas ventas.');
            }

            if (sucursal[0].imagen) {
                if (bucket) {
                    const file = bucket.file(sucursal[0].imagen);
                    await file.delete();
                }
            }

            await conec.execute(connection, `DELETE FROM sucursal WHERE idSucursal = ?`, [
                req.query.idSucursal
            ]);

            await conec.commit(connection);
            return sendSave(res, "Se eliminó correctamente el sucursal.");
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Sucursal/delete", error);
        }
    }

    async inicio(req, res) {
        try {
            const lista = await conec.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY p.idSucursal ASC) AS id,
                p.idSucursal,
                p.nombre,
                p.email,
                p.paginaWeb,
                p.direccion,
                p.ruta,
                p.estado
            FROM 
                sucursal AS p
            INNER JOIN
                perfilSucursal AS ps ON ps.idSucursal = p.idSucursal
            WHERE
                ps.idPerfil = ?`, [
                req.dataToken.idPerfil
            ]);

            const bucket = firebaseService.getBucket();

            const newLista = lista.map(function (item, index) {
                return {
                    ...item,
                    imagen: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
                }
            });

            return sendSuccess(res, newLista);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Sucursal/inicio", error);
        }
    }

    async idInicio(req, res) {
        try {
            const lista = await conec.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY p.idSucursal ASC) AS id,
                p.idSucursal,
                p.nombre,
                p.direccion,
                p.ruta,
                p.estado
            FROM 
                sucursal AS p
            WHERE p.idSucursal = ?`, [
                req.query.idSucursal
            ]);

            const bucket = firebaseService.getBucket();

            const newLista = lista.map(function (item, index) {
                return {
                    ...item,
                      imagen: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
                }
            });

            return sendSuccess(res, newLista[0]);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Sucursal/idInicio", error);
        }
    }


    async combo(req, res) {
        try {
            const sucursales = await conec.query(`
            SELECT 
                idSucursal,
                nombre 
            FROM 
                sucursal`)

            return sendSuccess(res, sucursales);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Sucursal/combo", error);
        }
    }

    async listForWeb(req, res) {
        try {
            const bucket = firebaseService.getBucket();

            const list = await conec.query(`
            SELECT  
                p.idSucursal,
                p.nombre,
                p.email,
                p.telefono,
                p.celular,
                p.email,
                p.paginaWeb,
                p.direccion,
                p.googleMaps,
                p.horarioAtencion,
                p.estado,
                p.principal,
                p.ruta AS imagen
            FROM 
                sucursal AS p
            WHERE 
                p.estado = 1`);

            const newData = list.map(item => {
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

            return sendSuccess(res, newData);
        } catch (error) {
            return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Sucursal/listForWeb", error);
        }
    }

}

module.exports = new Sucursal();