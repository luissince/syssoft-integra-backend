// database/conexion.js
const mysql = require('mysql');

/**
 * Clase Singleton para gestionar la conexión a la base de datos MySQL.
 */
class Conexion {
  /** @type {Conexion | null} */
  static instance = null;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      port: process.env.DB_PORT,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectionLimit: 20,
    });
  }

  /**
   * Retorna la única instancia de la conexión (Singleton).
   * @returns {Conexion}
   */
  static getInstance() {
    if (!Conexion.instance) {
      Conexion.instance = new Conexion();
    }
    return Conexion.instance;
  }

  /**
   * Ejecuta una consulta SQL.
   * @param {string} sql - Sentencia SQL.
   * @param {Array<any>} [param=[]] - Parámetros para la consulta.
   * @returns {Promise<any>} Resultado de la consulta.
   */
  query(sql, param = []) {
    return new Promise((resolve, reject) => {
      this.pool.getConnection((err, connection) => {
        if (err) return reject(err.sqlMessage);
        connection.query(sql, param, (err, result) => {
          connection.release();
          if (err) return reject(err.sqlMessage);
          return resolve(result);
        });
      });
    });
  }

  /**
   * Ejecuta un procedimiento almacenado y retorna solo el primer resultado.
   * @param {string} sql - Llamada al procedimiento.
   * @param {Array<any>} [param=[]] - Parámetros del procedimiento.
   * @returns {Promise<any>} Primer conjunto de resultados.
   */
  procedure(sql, param = []) {
    return new Promise((resolve, reject) => {
      this.pool.getConnection((err, connection) => {
        if (err) return reject(err.sqlMessage);
        connection.query(sql, param, (err, result) => {
          connection.release();
          if (err) return reject(err.sqlMessage);
          return resolve(result[0]);
        });
      });
    });
  }

  /**
   * Ejecuta un procedimiento almacenado y retorna todos los resultados.
   * @param {string} sql - Llamada al procedimiento.
   * @param {Array<any>} [param=[]] - Parámetros del procedimiento.
   * @returns {Promise<any>} Todos los conjuntos de resultados.
   */
  procedureAll(sql, param = []) {
    return new Promise((resolve, reject) => {
      this.pool.getConnection((err, connection) => {
        if (err) return reject(err.sqlMessage);
        connection.query(sql, param, (err, result) => {
          connection.release();
          if (err) return reject(err.sqlMessage);
          return resolve(result);
        });
      });
    });
  }

  /**
   * Inicia una transacción.
   * @returns {Promise<import("mysql").PoolConnection>} Conexión activa para la transacción.
   */
  beginTransaction() {
    return new Promise((resolve, reject) => {
      this.pool.getConnection((err, connection) => {
        if (err) return reject(err.sqlMessage);

        connection.beginTransaction((err) => {
          if (err) return reject(err.sqlMessage);
          return resolve(connection);
        });
      });
    });
  }

  /**
   * Ejecuta una sentencia dentro de una transacción.
   * @param {import("mysql").PoolConnection} connection - Conexión activa.
   * @param {string} sql - Sentencia SQL.
   * @param {Array<any>} [param=[]] - Parámetros.
   * @returns {Promise<any>} Resultado de la consulta.
   */
  execute(connection, sql, param = []) {
    return new Promise((resolve, reject) => {
      connection.query(sql, param, (err, result) => {
        if (err) return reject(err.sqlMessage);
        return resolve(result);
      });
    });
  }

  /**
   * Hace commit de una transacción.
   * @param {import("mysql").PoolConnection} connection - Conexión activa.
   * @returns {Promise<void>}
   */
  commit(connection) {
    return new Promise((resolve, reject) => {
      connection.commit((err) => {
        if (err) {
          return connection.rollback(() => reject(err.sqlMessage));
        }
        connection.release();
        return resolve();
      });
    });
  }

  /**
   * Hace rollback de una transacción.
   * @param {import("mysql").PoolConnection} connection - Conexión activa.
   * @returns {Promise<void>}
   */
  rollback(connection) {
    return new Promise((resolve, reject) => {
      connection.rollback((err) => {
        if (err) return reject(err.sqlMessage);
        connection.release();
        return resolve();
      });
    });
  }

  /**
   * Realiza un `UPDATE` dinámico en una tabla.
   * @param {Record<string, any>} json - Objeto con campos y valores a actualizar.
   * @param {string} tablaName - Nombre de la tabla.
   * @param {string} where - Nombre de la columna para la condición.
   * @param {any} id - Valor para la condición.
   * @returns {Promise<void>}
   */
  async update(json, tablaName, where, id) {
    const campos = Object.keys(json);
    let sql = `UPDATE ${tablaName} SET `;
    sql += campos.map((campo) => `${campo} = ?`).join(", ");
    sql += ` WHERE ${where} = ?`;

    const valores = campos.map((campo) => json[campo]);
    valores.push(id);

    await this.query(sql, valores);
  }
}

module.exports = Conexion.getInstance();


// const mysql = require('mysql');
// /**
//  * Clase para gestionar la conexión a la base de datos MySQL.
//  */
// class Conexion {
//     constructor() {
//         this.pool = mysql.createPool({
//             host: process.env.DB_HOST,
//             user: process.env.DB_USER,
//             port: process.env.DB_PORT,
//             password: process.env.DB_PASSWORD,
//             database: process.env.DB_NAME,
//             connectionLimit: 20
//         });
//     }

//     query(slq, param = []) {
//         return new Promise((resolve, reject) => {
//             this.pool.getConnection((err, connection) => {
//                 if (err) return reject(err.sqlMessage);
//                 connection.query(slq, param, (err, result) => {
//                     if (err) return reject(err.sqlMessage);
//                     connection.release();
//                     return resolve(result);
//                 });
//             });
//         });
//     }

//     procedure(slq, param = []) {
//         return new Promise((resolve, reject) => {
//             this.pool.getConnection((err, connection) => {
//                 if (err) return reject(err.sqlMessage);
//                 connection.query(slq, param, (err, result) => {
//                     if (err) return reject(err.sqlMessage);
//                     connection.release();
//                     return resolve(result[0]);
//                 });
//             });
//         });
//     }

//     procedureAll(slq, param = []) {
//         return new Promise((resolve, reject) => {
//             this.pool.getConnection((err, connection) => {
//                 if (err) return reject(err.sqlMessage);
//                 connection.query(slq, param, (err, result) => {
//                     if (err) return reject(err.sqlMessage);
//                     connection.release();
//                     return resolve(result);
//                 });
//             });
//         });
//     }

//     beginTransaction() {
//         return new Promise((resolve, reject) => {
//             this.pool.getConnection((err, connection) => {
//                 if (err) {
//                     return reject(err.sqlMessage);
//                 }

//                 connection.beginTransaction(function (err) {
//                     if (err) {
//                         return reject(err.sqlMessage);
//                     }

//                     return resolve(connection)
//                 });
//             });
//         });
//     }

//     execute(connection, slq, param = []) {
//         return new Promise((resolve, reject) => {
//             connection.query(slq, param, (err, result) => {
//                 if (err) return reject(err.sqlMessage);
//                 return resolve(result);
//             });
//         });
//     }

//     commit(connection) {
//         return new Promise((resolve, reject) => {
//             connection.commit((err) => {
//                 if (err) {
//                     return connection.rollback((err) => {
//                         reject(err.sqlMessage);
//                     });
//                 };

//                 connection.release();
//                 return resolve();
//             });
//         });
//     }

//     rollback(connection) {
//         return new Promise((resolve, reject) => {
//             connection.rollback((err) => {
//                 if (err) {
//                     return reject(err.sqlMessage);
//                 }

//                 connection.release();
//                 return resolve();
//             });
//         });
//     }

//     async update(json, tablaName, where ,id) {
//         // Obtener los nombres de las propiedades del objeto JSON
//         const campos = Object.keys(json);

//         // Construir la consulta SQL dinámicamente
//         let sql = `UPDATE ${tablaName} SET `;
//         campos.forEach((campo, index) => {
//             sql += `${campo} = ?`;
//             if (index < campos.length - 1) {
//                 sql += `, `;
//             }
//         });
//         sql += ` WHERE ${where} = ?`;

//         // Obtener los valores de los campos del objeto JSON
//         const valores = campos.map(campo => json[campo]);
//         valores.push(id);
        
//         // Ejecutar la consulta SQL
//         await this.query(sql, valores);
//     }

// }

// module.exports = Conexion;