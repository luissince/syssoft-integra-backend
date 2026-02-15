const conec = require('../database/mysql-connection');
const { currentDate, currentTime, generateAlphanumericCode } = require("../tools/Tools");

class UbicacionService {

  async list(opcion, buscar, posicionPagina, filasPorPagina) {
    const lista = await conec.procedure(`CALL Listar_Ubicaciones(?,?,?,?)`, [
      opcion,
      buscar,
      posicionPagina,
      filasPorPagina
    ]);

    const resultLista = lista.map((item, index) => ({
      ...item,
      id: index + 1 + posicionPagina,
    }));

    const total = await conec.procedure(`CALL Listar_Ubicaciones_Count(?,?)`, [
      opcion,
      buscar
    ]);

    return { result: resultLista, total: total[0].Total };
  }


  async id(idUbicacion) {
    const result = await conec.query(`
      SELECT 
        *
      FROM 
        ubicacion 
      WHERE 
        idUbicacion = ?`,[
        idUbicacion
    ]);

    return result[0];
  }


  async add(data) {
    let connection = null;

    try {
      connection = await conec.beginTransaction();

      const result = await conec.execute(connection, "SELECT idUbicacion FROM ubicacion");
      const idUbicacion = generateAlphanumericCode("UB0001", result, 'idUbicacion');

      await conec.execute(connection, `
        INSERT INTO ubicacion(
          idUbicacion,
          descripcion,
          estado,
          fecha,
          hora,
          idUsuario
        ) VALUES(?,?,?,?,?,?)`,[
          idUbicacion,
          data.descripcion,
          data.estado,
          currentDate(),
          currentTime(),
          data.idUsuario,
        ]);

      await conec.commit(connection);
      return "Se registró correctamente la ubicación.";

    } catch (error) {
      if (connection) await conec.rollback(connection);
      throw error;
    }
  }


  async edit(data) {
    let connection = null;

    try {
      connection = await conec.beginTransaction();

      await conec.execute(connection, `
        UPDATE ubicacion SET
          descripcion = ?,
          estado = ?,
          fecha = ?,
          hora = ?,
          idUsuario = ?
        WHERE idUbicacion = ?`,[
          data.descripcion,
          data.estado,
          currentDate(),
          currentTime(),
          data.idUsuario,
          data.idUbicacion,
        ]);

      await conec.commit(connection);
      return "Se actualizó correctamente la ubicación.";

    } catch (error) {
      if (connection) await conec.rollback(connection);
      throw error;
    }
  }


  async delete(idUbicacion) {
    let connection = null;

    try {
      connection = await conec.beginTransaction();

      await conec.execute(connection, `
        DELETE FROM 
          ubicacion 
        WHERE 
          idUbicacion = ?`,[
            idUbicacion
      ]);

      await conec.commit(connection);
      return "Se eliminó correctamente la ubicación.";

    } catch (error) {
      if (connection) await conec.rollback(connection);
      throw error;
    }
  }


  async combo() {
    return await conec.query(`
      SELECT 
        idUbicacion, 
        descripcion
      FROM 
        ubicacion
      WHERE 
        estado = 1`
    );
  }

}

module.exports = new UbicacionService();
