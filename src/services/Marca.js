const Conexion = require("../database/Conexion");
const { sendError, sendSuccess, sendSave, sendClient } = require("../tools/Message");
const { currentDate, currentTime, generateAlphanumericCode } = require("../tools/Tools");
const conec = new Conexion();

class Marca {

  async list(req, res) {
    try {
      const lista = await conec.procedure(`CALL Listar_Marca(?,?,?,?)`, [
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
      const result = await conec.query(`
      SELECT
        idMarca,
        codigo,
        nombre,
        descripcion,
        estado
      FROM 
        marca 
      WHERE 
        idMarca = ?`, [
        req.query.idMarca
      ]);

      return sendSuccess(res, result[0]);
    } catch (error) {
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Marca/id", error);
    }
  }

  async add(req, res) {
    let connection = null;
    try {
      connection = await conec.beginTransaction();

      const result = await conec.execute(connection, "SELECT idMarca FROM marca");
      const idMarca = generateAlphanumericCode("MC0001", result, 'idMarca');

      await conec.execute(connection, `INSERT INTO marca(
            idMarca,
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
        idMarca,
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

      await conec.execute(connection, `
      UPDATE 
        marca 
      SET
        codigo = ?,
        nombre = ?,
        descripcion = ?,
        estado = ?,
        fupdate = ?,
        hupdate = ?,
        idUsuario = ?
      WHERE 
        idMarca  = ?`, [
        req.body.codigo,
        req.body.nombre,
        req.body.descripcion,
        req.body.estado,
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

      const producto = await conec.execute(connection, `SELECT * FROM producto WHERE idMarca = ?`, [
        req.query.idMarca
      ]);

      if (producto.length > 0) {
        await conec.rollback(connection);
        return sendClient(res, "No se puede eliminar la marca ya que esta ligada a un producto.");
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
      const result = await conec.query(`
      SELECT 
        idMarca,
        nombre 
      FROM 
        marca 
      WHERE 
        estado = 1`);

      return sendSuccess(res, result);
    } catch (error) {
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Marca/combo", error);
    }
  }
}

module.exports = Marca;
