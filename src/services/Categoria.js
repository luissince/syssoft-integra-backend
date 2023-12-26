const Conexion = require("../database/Conexion");
const { currentDate, currentTime, generateAlphanumericCode } = require("../tools/Tools");
const conec = new Conexion();

class Categoria {

  async list(req) {
    try {
      const lista = await conec.query(`SELECT 
            m.idCategoria,
            m.nombre,     
            m.descripcion,     
            m.estado,
            DATE_FORMAT(m.fecha,'%d/%m/%Y') as fecha,
            m.hora
            FROM categoria AS m 
            WHERE
            ? = 0  
            OR
            ? = 1 AND m.nombre LIKE CONCAT(?,'%')
            LIMIT ?,?`, [
            parseInt(req.query.opcion),

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

      const total = await conec.query(`SELECT COUNT(*) AS Total     
            FROM categoria AS m
            WHERE
            ? = 0 
            OR
            ? = 1 AND m.nombre LIKE CONCAT(?,'%')`, [
            parseInt(req.query.opcion),

            parseInt(req.query.opcion),
            req.query.buscar
      ]);

      return { result: resultLista, total: total[0].Total };
    } catch (error) {
      return "Error interno de conexión, intente nuevamente.";
    }
  }

  async id(req) {
    try {
      const result = await conec.query(`SELECT
        idCategoria,
        nombre,
        descripcion,
        estado
        FROM categoria 
        WHERE idCategoria = ?`, [
        req.query.idCategoria
      ]);

      return result[0];
    } catch (error) {
      return "Error interno de conexión, intente nuevamente.";
    }
  }

  async add(req) {
    let connection = null;
    try {
      connection = await conec.beginTransaction();

      const result = await conec.execute(connection, "SELECT idCategoria FROM categoria");
      const idCategoria = generateAlphanumericCode("CT0001", result, 'idCategoria');

      await conec.execute(connection, `INSERT INTO categoria(
            idCategoria,
            nombre,
            descripcion,
            estado,
            fecha,
            hora,
            fupdate,
            hupdate,
            idUsuario) 
          VALUES(?,?,?,?,?,?,?,?,?)`, [
        idCategoria,
        req.body.nombre,
        req.body.descripcion,
        req.body.estado,
        currentDate(),
        currentTime(),
        currentDate(),
        currentTime(),
        req.body.idUsuario,]);

      await conec.commit(connection);
      return "insert";
    } catch (error) {
      if (connection != null) {
        await conec.rollback(connection);
      }
      return "Error interno de conexión, intente nuevamente.";
    }
  }

  async edit(req) {
    let connection = null;
    try {
      connection = await conec.beginTransaction();

      await conec.execute(connection, `UPDATE categoria SET
            nombre = ?,
            descripcion = ?,
            estado = ?,
            fupdate = ?,
            hupdate = ?,
            idUsuario = ?
            WHERE idCategoria  = ?`, [
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
      return "update";
    } catch (error) {
      if (connection != null) {
        await conec.rollback(connection);
      }
      return "Error interno de conexión, intente nuevamente.";
    }
  }

  async delete(req) {
    let connection = null;
    try {
      connection = await conec.beginTransaction();

      const producto = await conec.execute(connection, `SELECT * FROM producto WHERE idCategoria = ?`,
        [req.query.idCategoria]
      );

      if (producto.length > 0) {
        await conec.rollback(connection);
        return "No se puede eliminar la categoria ya que esta ligada a un producto.";
      }

      await conec.execute(connection, `DELETE FROM categoria WHERE idCategoria  = ?`,
        [req.query.idCategoria]
      );

      await conec.commit(connection);
      return "delete";
    } catch (error) {
      if (connection != null) {
        await conec.rollback(connection);
      }
      return "Error interno de conexión, intente nuevamente.";
    }
  }

  async combo(req) {
    try {
      const result = await conec.query(`SELECT 
      idCategoria,
      nombre 
      FROM categoria 
      WHERE estado = 1`);
      return result;
    } catch (error) {      
      return "Error interno de conexión, intente nuevamente.";
    }
  }

}

module.exports = Categoria;
