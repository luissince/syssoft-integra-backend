const Conexion = require("../database/Conexion");
const { sendError, sendSuccess, sendSave, sendClient } = require("../tools/Message");
const { currentDate, currentTime, generateAlphanumericCode } = require("../tools/Tools");
const conec = new Conexion();

class Categoria {

  async list(req, res) {
    try {
      const lista = await conec.procedure(`CALL Listar_Categoria(?,?,?,?)`, [
        parseInt(req.query.opcion),
        req.query.buscar,

        parseInt(req.query.posicionPagina),
        parseInt(req.query.filasPorPagina)
      ]);

      const resultLista = lista.map(function (item, index) {
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
      const result = await conec.query(`
      SELECT
        idCategoria,
        codigo,
        nombre,
        descripcion,
        estado
      FROM 
        categoria 
      WHERE 
        idCategoria = ?`, [
        req.query.idCategoria
      ]);

      return sendSuccess(res, result[0]);
    } catch (error) {
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Categoria/id", error);
    }
  }

  async add(req, res) {
    let connection = null;
    try {
      connection = await conec.beginTransaction();

      const result = await conec.execute(connection, "SELECT idCategoria FROM categoria");
      const idCategoria = generateAlphanumericCode("CT0001", result, 'idCategoria');

      await conec.execute(connection, `INSERT INTO categoria(
            idCategoria,
            codigo,
            nombre,
            descripcion,
            estado,
            fecha,
            hora,
            fupdate,
            hupdate,
            idUsuario
          ) VALUES(?,?,?,?,?,?,?,?,?,?)`, [
        idCategoria,
        req.body.codigo,
        req.body.nombre,
        req.body.descripcion,
        req.body.estado,
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

      await conec.execute(connection, `
      UPDATE 
        categoria 
      SET
        codigo = ?,
        nombre = ?,
        descripcion = ?,
        estado = ?,
        fupdate = ?,
        hupdate = ?,
        idUsuario = ?
      WHERE 
        idCategoria  = ?`, [
        req.body.codigo,
        req.body.nombre,
        req.body.descripcion,
        req.body.estado,
        currentDate(),
        currentTime(),
        req.body.idUsuario,
        req.body.idCategoria,
      ]
      );

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

      const producto = await conec.execute(connection, `SELECT * FROM producto WHERE idCategoria = ?`, [
        req.query.idCategoria
      ]);

      if (producto.length > 0) {
        await conec.rollback(connection);
        return sendClient(res, "No se puede eliminar la categoria ya que esta ligada a un producto.");
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
      const result = await conec.query(`
      SELECT 
        idCategoria,
        nombre 
      FROM 
        categoria 
      WHERE 
        estado = 1`);

      return sendSuccess(res, result);
    } catch (error) {
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Categoria/combo", error);
    }
  }
}

module.exports = Categoria;
