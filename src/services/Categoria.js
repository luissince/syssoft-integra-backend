const conec = require('../database/mysql-connection');
const FirebaseService = require("../tools/FiraseBaseService");
const { sendError, sendSuccess, sendSave, sendClient } = require("../tools/Message");
const { currentDate, currentTime, generateAlphanumericCode } = require("../tools/Tools");
const firebaseService = new FirebaseService();

class Categoria {

  async list(req, res) {
    try {
      const list = await conec.procedure(`CALL Listar_Categoria(?,?,?,?)`, [
        parseInt(req.query.opcion),
        req.query.buscar,

        parseInt(req.query.posicionPagina),
        parseInt(req.query.filasPorPagina)
      ]);

      const bucket = firebaseService.getBucket();

      const resultLista = list.map(function (item, index) {
        if (bucket && item.imagen) {
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

      const total = await conec.procedure(`CALL Listar_Categoria_Count(?,?)`, [
        parseInt(req.query.opcion),
        req.query.buscar
      ]);

      return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
    } catch (error) {
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Categoria/list", error);
    }
  }

  async id(req, res) {
    try {
      const bucket = firebaseService.getBucket();

      const result = await conec.query(`
      SELECT
        idCategoria,
        codigo,
        nombre,
        descripcion,
        estado,
        imagen
      FROM 
        categoria 
      WHERE 
        idCategoria = ?`, [
        req.query.idCategoria
      ]);

      if (bucket && result[0].imagen) {
        result[0].imagen = {
          nombre: result[0].imagen,
          url: `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${result[0].imagen}`
        }
      }

      return sendSuccess(res, result[0]);
    } catch (error) {
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Categoria/id", error);
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
          const fileName = `category_${timestamp}_${uniqueId}.${req.body.imagen.extension}`;

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

      const result = await conec.execute(connection, "SELECT idCategoria FROM categoria");
      const idCategoria = generateAlphanumericCode("CT0001", result, 'idCategoria');

      await conec.execute(connection, `INSERT INTO categoria(
            idCategoria,
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
        idCategoria,
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

      return sendSave(res, "Se registró correctamente la categoria.");
    } catch (error) {
      if (connection != null) {
        await conec.rollback(connection);
      }
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Categoria/add", error);
    }
  }

  async edit(req, res) {
    let connection = null;
    try {
      connection = await conec.beginTransaction();

      const bucket = firebaseService.getBucket();

      const categoria = await await conec.execute(connection, `
        SELECT 
            imagen 
        FROM 
            categoria 
        WHERE 
            idCategoria = ?`, [
        req.body.idCategoria
      ]);

      let imagen = null;

      if (req.body.imagen && req.body.imagen.nombre === undefined && req.body.imagen.base64 === undefined) {
        if (bucket) {
          if (categoria[0].imagen) {
            const file = bucket.file(categoria[0].imagen);
            await file.delete();
          }
        }

      } else if (req.body.imagen && req.body.imagen.base64 !== undefined) {
        if (bucket) {
          if (categoria[0].imagen) {
            const file = bucket.file(categoria[0].imagen);
            if (file.exists()) {
              await file.delete();
            }
          }

          const buffer = Buffer.from(req.body.imagen.base64, 'base64');

          const timestamp = Date.now();
          const uniqueId = Math.random().toString(36).substring(2, 9);
          const fileName = `category_${timestamp}_${uniqueId}.${req.body.imagen.extension}`;

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
        categoria 
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
        idCategoria  = ?`, [
        req.body.codigo,
        req.body.nombre,
        req.body.descripcion,
        req.body.estado,
        imagen,
        currentDate(),
        currentTime(),
        req.body.idUsuario,
        req.body.idCategoria,
      ]);

      await conec.commit(connection);
      return sendSave(res, "Se actualizó correctamente la categoria.");
    } catch (error) {
      if (connection != null) {
        await conec.rollback(connection);
      }
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Categoria/edit", error);
    }
  }

  async delete(req, res) {
    let connection = null;
    try {
      connection = await conec.beginTransaction();

      const bucket = firebaseService.getBucket();

      const producto = await conec.execute(connection, `SELECT * FROM producto WHERE idCategoria = ?`, [
        req.query.idCategoria
      ]);

      if (producto.length > 0) {
        await conec.rollback(connection);
        return sendClient(res, "No se puede eliminar la categoria ya que esta ligada a un producto.");
      }

      const categoria = await conec.execute(connection, `SELECT * FROM categoria WHERE idCategoria  = ?`, [
        req.query.idCategoria
      ]);

      if (categoria.length !== 0) {
        await conec.rollback(connection);
        return sendClient(res, "No se puede eliminar la categoría porque no existe.");
      }

      if (categoria[0].imagen) {
        if (bucket) {
          const file = bucket.file(categoria[0].imagen);
          await file.delete();
        }
      }

      await conec.execute(connection, `DELETE FROM categoria WHERE idCategoria  = ?`, [
        req.query.idCategoria
      ]);

      await conec.commit(connection);
      return sendSave(res, "Se eliminó correctamente la categoria.");
    } catch (error) {
      if (connection != null) {
        await conec.rollback(connection);
      }
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Categoria/delete", error);
    }
  }

  async combo(req, res) {
    try {
      const bucket = firebaseService.getBucket();

      const result = await conec.query(`
      SELECT 
        idCategoria,
        nombre,
        imagen
      FROM 
        categoria 
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
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Categoria/combo", error);
    }
  }
}

module.exports = Categoria;
