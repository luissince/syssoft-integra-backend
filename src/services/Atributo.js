const Conexion = require("../database/Conexion");
const { sendError, sendSuccess, sendSave, sendClient } = require("../tools/Message");
const { currentDate, currentTime, generateAlphanumericCode } = require("../tools/Tools");
const conec = new Conexion();

class Atributo {

  async list(req, res) {
    try {
      const lista = await conec.procedure(`CALL Listar_Atributos(?,?,?,?)`, [
        parseInt(req.query.opcion),
        req.query.buscar,

        parseInt(req.query.posicionPagina),
        parseInt(req.query.filasPorPagina)
      ]);

      const resultLista = lista.map(function (item, index) {
        return {
          id: index + 1 + parseInt(req.query.posicionPagina),
          idAtributo: item.idAtributo,
          nombre: item.nombre,
          hexadecimal: item.hexadecimal,
          valor: item.valor,
          estado: item.estado,
          fecha: item.fecha,
          hora: item.hora,
          tipoAtributo: {
            idTipoAtributo: item.idTipoAtributo,
            nombre: item.nombreTipoAtributo
          }
        };
      });

      const total = await conec.procedure(`CALL Listar_Atributos_Count(?,?)`, [
        parseInt(req.query.opcion),
        req.query.buscar
      ]);

      return sendSuccess(res, { "result": resultLista, "total": total[0].Total });
    } catch (error) {
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Atributo/list", error);
    }
  }

  async id(req, res) {
    try {
      const result = await conec.query(`
      SELECT
        idAtributo,
        idTipoAtributo,
        nombre,
        hexadecimal,
        valor,
        estado
      FROM 
        atributo 
      WHERE 
        idAtributo = ?`, [
        req.query.idAtributo
      ]);

      return sendSuccess(res, result[0]);
    } catch (error) {
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Atributo/id", error);
    }
  }

  async add(req, res) {
    let connection = null;
    try {
      connection = await conec.beginTransaction();

      const result = await conec.execute(connection, "SELECT idAtributo FROM atributo");
      const idAtributo = generateAlphanumericCode("AT0001", result, 'idAtributo');

      await conec.execute(connection, `INSERT INTO atributo(
            idAtributo,
            idTipoAtributo,
            nombre,
            hexadecimal,
            valor,
            estado,
            fecha,
            hora,
            fupdate,
            hupdate,
            idUsuario
          ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [
        idAtributo,
        req.body.idTipoAtributo,
        req.body.nombre,
        req.body.hexadecimal,
        req.body.valor,
        req.body.estado,
        currentDate(),
        currentTime(),
        currentDate(),
        currentTime(),
        req.body.idUsuario,
      ]);

      await conec.commit(connection);

      return sendSave(res, "Se registró correctamente la atributo.");
    } catch (error) {
      if (connection != null) {
        await conec.rollback(connection);
      }
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Atributo/add", error);
    }
  }

  async edit(req, res) {
    let connection = null;
    try {
      connection = await conec.beginTransaction();

      await conec.execute(connection, `
      UPDATE 
        atributo 
      SET
        nombre = ?,
        hexadecimal = ?,
        valor = ?,
        estado = ?,
        fupdate = ?,
        hupdate = ?,
        idUsuario = ?
      WHERE 
        idAtributo  = ?`, [
        req.body.nombre,
        req.body.hexadecimal,
        req.body.valor,
        req.body.estado,
        currentDate(),
        currentTime(),
        req.body.idUsuario,
        req.body.idAtributo,
      ]
      );

      await conec.commit(connection);
      return sendSave(res, "Se actualizó correctamente la atributo.");
    } catch (error) {
      if (connection != null) {
        await conec.rollback(connection);
      }
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Atributo/edit", error);
    }
  }

  async delete(req, res) {
    let connection = null;
    try {
      connection = await conec.beginTransaction();

      await conec.execute(connection, `DELETE FROM atributo WHERE idAtributo  = ?`, [
        req.query.idAtributo
      ]);

      await conec.commit(connection);
      return sendSave(res, "Se eliminó correctamente el atributo.");
    } catch (error) {
      if (connection != null) {
        await conec.rollback(connection);
      }
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Atributo/delete", error);
    }
  }

  async combo(req, res) {
    try {
      const result = await conec.query(`
      SELECT 
        idAtributo,
        idTipoAtributo,
        nombre,
        hexadecimal,
        valor
      FROM 
        atributo 
      WHERE 
        estado = 1 AND idTipoAtributo = ?`, [
        req.query.idTipoAtributo
      ]);

      return sendSuccess(res, result);
    } catch (error) {
      return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Atributo/combo", error);
    }
  }
}

module.exports = Atributo;