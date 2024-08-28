const mysql = require('mysql');
require('dotenv').config();

/**
 * Clase para gestionar la conexión a la base de datos MySQL.
 */
class Conexion {
    constructor() {
        this.pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            port: process.env.DB_PORT,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            connectionLimit: 20
        });
    }

    query(slq, param = []) {
        return new Promise((resolve, reject) => {
            this.pool.getConnection((err, connection) => {
                if (err) return reject(err.sqlMessage);
                connection.query(slq, param, (err, result) => {
                    if (err) return reject(err.sqlMessage);
                    connection.release();
                    return resolve(result);
                });
            });
        });
    }

    procedure(slq, param = []) {
        return new Promise((resolve, reject) => {
            this.pool.getConnection((err, connection) => {
                if (err) return reject(err.sqlMessage);
                connection.query(slq, param, (err, result) => {
                    if (err) return reject(err.sqlMessage);
                    connection.release();
                    return resolve(result[0]);
                });
            });
        });
    }

    beginTransaction() {
        return new Promise((resolve, reject) => {
            this.pool.getConnection((err, connection) => {
                if (err) {
                    return reject(err.sqlMessage);
                }

                connection.beginTransaction(function (err) {
                    if (err) {
                        return reject(err.sqlMessage);
                    }

                    return resolve(connection)
                });
            });
        });
    }

    execute(connection, slq, param = []) {
        return new Promise((resolve, reject) => {
            connection.query(slq, param, (err, result) => {
                if (err) return reject(err.sqlMessage);
                return resolve(result);
            });
        });
    }

    commit(connection) {
        return new Promise((resolve, reject) => {
            connection.commit((err) => {
                if (err) {
                    return connection.rollback((err) => {
                        reject(err.sqlMessage);
                    });
                };

                connection.release();
                return resolve();
            });
        });
    }

    rollback(connection) {
        return new Promise((resolve, reject) => {
            connection.rollback((err) => {
                if (err) {
                    return reject(err.sqlMessage);
                }

                connection.release();
                return resolve();
            });
        });
    }

    async update(json, tablaName, where ,id) {
        // Obtener los nombres de las propiedades del objeto JSON
        const campos = Object.keys(json);

        // Construir la consulta SQL dinámicamente
        let sql = `UPDATE ${tablaName} SET `;
        campos.forEach((campo, index) => {
            sql += `${campo} = ?`;
            if (index < campos.length - 1) {
                sql += `, `;
            }
        });
        sql += ` WHERE ${where} = ?`;

        // Obtener los valores de los campos del objeto JSON
        const valores = campos.map(campo => json[campo]);
        valores.push(id);
        
        // Ejecutar la consulta SQL
        await this.query(sql, valores);
    }

}

module.exports = Conexion;