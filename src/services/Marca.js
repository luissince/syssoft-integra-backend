const conec = require('../database/mysql-connection');
const FirebaseService = require("../tools/FiraseBaseService");
const { sendError, sendSuccess, sendSave, sendClient } = require("../tools/Message");
const { currentDate, currentTime, generateAlphanumericCode } = require("../tools/Tools");
const firebaseService = new FirebaseService();

class Marca {

  async list(req, res) {
    try {
      const list = await conec.procedure(`CALL Listar_Marca(?,?,?,?)`, [
        parseInt(req.query.opcion),
        req.query.buscar,

        parseInt(req.query.posicionPagina),
        parseInt(req.query.filasPorPagina)
      ]);

      const bucket = firebaseService.getBucket();

      const resultLista = list.map(function (item, index) {
        if(bucket && item.imagen) {
          return {
            ...item,
            imagen: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}`,
            id: (index + 1) + parseInt(req.query.posicionPagina)
          }
        }

        return {
          ...item,
          id: index + 1 + parseInt(req.query.posicionPagina),
        };
      });

      const total = await conec.procedure(`CALL Listar_Marca_Count(?,?)`, [
        parseInt(req.query.opcion),
        req.query.buscar
      ]);

      return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
    } catch (error) {
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Marca/list", error);
    }
  }

  async id(req, res) {
    try {
      const bucket = firebaseService.getBucket();

      const result = await conec.query(`
      SELECT
        idMarca,
        codigo,
        nombre,
        descripcion,
        estado,
        imagen
      FROM 
        marca 
      WHERE 
        idMarca = ?`, [
        req.query.idMarca
      ]);

      if (bucket && result[0].imagen) {
        result[0].imagen = {
          nombre: result[0].imagen,
          url: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${result[0].imagen}`
        }
      }

      return sendSuccess(res, result[0]);
    } catch (error) {
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Marca/id", error);
    }
  }

  async add(req, res) {
    let connection = null;
    try {
      connection = await conec.beginTransaction();

      const bucket = firebaseService.getBucket();

      let imagen = null;

      if (req.body.imagen && req.body.imagen.base64 !== undefined) {
        if (bucket) {
          const buffer = Buffer.from(req.body.imagen.base64, 'base64');

          const timestamp = Date.now();
          const uniqueId = Math.random().toString(36).substring(2, 9);
          const fileName = `brand_${timestamp}_${uniqueId}.${req.body.imagen.extension}`;

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

      const result = await conec.execute(connection, "SELECT idMarca FROM marca");
      const idMarca = generateAlphanumericCode("MC0001", result, 'idMarca');

      await conec.execute(connection, `INSERT INTO marca(
            idMarca,
            codigo,
            nombre,
            descripcion,
            estado,
            imagen,
            fecha,
            hora,
            fupdate,
            hupdate,
            idUsuario
          ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [
        idMarca,
        req.body.codigo,
        req.body.nombre,
        req.body.descripcion,
        req.body.estado,
        imagen,
        currentDate(),
        currentTime(),
        currentDate(),
        currentTime(),
        req.body.idUsuario,
      ]);

      await conec.commit(connection);

      return sendSave(res, "Se registró correctamente la marca.");
    } catch (error) {
      if (connection != null) {
        await conec.rollback(connection);
      }
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Marca/add", error);
    }
  }

  async edit(req, res) {
    let connection = null;
    try {
      connection = await conec.beginTransaction();

      const bucket = firebaseService.getBucket();

      const marca = await await conec.execute(connection, `
        SELECT 
            imagen 
        FROM 
            marca 
        WHERE 
            idMarca = ?`, [
        req.body.idMarca
      ]);

      let imagen = null;

      if (req.body.imagen && req.body.imagen.nombre === undefined && req.body.imagen.base64 === undefined) {
        if (bucket) {
          if (marca[0].imagen) {
            const file = bucket.file(marca[0].imagen);
            await file.delete();
          }
        }

      } else if (req.body.imagen && req.body.imagen.base64 !== undefined) {
        if (bucket) {
          if (marca[0].imagen) {
            const file = bucket.file(marca[0].imagen);
            if (file.exists()) {
              await file.delete();
            }
          }

          const buffer = Buffer.from(req.body.imagen.base64, 'base64');

          const timestamp = Date.now();
          const uniqueId = Math.random().toString(36).substring(2, 9);
          const fileName = `brand_${timestamp}_${uniqueId}.${req.body.imagen.extension}`;

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

      await conec.execute(connection, `
      UPDATE 
        marca 
      SET
        codigo = ?,
        nombre = ?,
        descripcion = ?,
        estado = ?,
        imagen = ?,
        fupdate = ?,
        hupdate = ?,
        idUsuario = ?
      WHERE 
        idMarca  = ?`, [
        req.body.codigo,
        req.body.nombre,
        req.body.descripcion,
        req.body.estado,
        imagen,
        currentDate(),
        currentTime(),
        req.body.idUsuario,
        req.body.idMarca,
      ]
      );

      await conec.commit(connection);
      return sendSave(res, "Se actualizó correctamente la marca.");
    } catch (error) {
      if (connection != null) {
        await conec.rollback(connection);
      }
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Marca/edit", error);
    }
  }

  async delete(req, res) {
    let connection = null;
    try {
      connection = await conec.beginTransaction();

      const bucket = firebaseService.getBucket();

      const producto = await conec.execute(connection, `SELECT * FROM producto WHERE idMarca = ?`, [
        req.query.idMarca
      ]);

      if (producto.length > 0) {
        await conec.rollback(connection);
        return sendClient(res, "No se puede eliminar la marca ya que esta ligada a un producto.");
      }

      const marca = await conec.execute(connection, `SELECT * FROM marca WHERE idMarca  = ?`, [
        req.query.idMarca
      ]);

      if (marca.length !== 0) {
        await conec.rollback(connection);
        return sendClient(res, "No se puede eliminar la marca porque no existe.");
      }

      if (marca[0].imagen) {
        if (bucket) {
          const file = bucket.file(marca[0].imagen);
          await file.delete();
        }
      }

      await conec.execute(connection, `DELETE FROM marca WHERE idMarca  = ?`, [
        req.query.idMarca
      ]);

      await conec.commit(connection);
      return sendSave(res, "Se eliminó correctamente la marca.");
    } catch (error) {
      if (connection != null) {
        await conec.rollback(connection);
      }
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Marca/delete", error);
    }
  }

  async combo(req, res) {
    try {
      const bucket = firebaseService.getBucket();

      const result = await conec.query(`
      SELECT 
        idMarca,
        nombre,
        imagen 
      FROM 
        marca 
      WHERE 
        estado = 1`);

      const newData = result.map(item => {
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
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Marca/combo", error);
    }
  }
}

module.exports = Marca;
