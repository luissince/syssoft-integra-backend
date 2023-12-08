const { sendSuccess, sendError } = require('../tools/Message');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Kardex {

    async list(req, res) {
        try {
            const kardex = await conec.query(`
            SELECT 
                p.idProducto,
                tk.nombre AS tipo,
                DATE_FORMAT(k.fecha, '%d/%m/%Y') AS fecha,
                k.hora,
                k.detalle,
                k.cantidad,
                k.costo,
                al.nombre AS almacen,
                u.apellidos,
                u.nombres
            FROM 
                kardex AS k 
                INNER JOIN producto AS p ON k.idProducto = p.idProducto
                INNER JOIN tipoKardex AS tk ON k.idTipoKardex = tk.IdTipoKardex
                INNER JOIN almacen AS al ON k.idAlmacen = al.idAlmacen
                INNER JOIN usuario AS u ON k.idUsuario = u.idUsuario
            WHERE
                (? = "" AND k.idProducto = ?)
                OR 
                (al.idAlmacen = ? AND k.idProducto = ?)
            ORDER BY 
                k.fecha ASC, 
                k.hora ASC;`, [
                req.query.idAlmacen,
                req.query.idProducto,

                req.query.idAlmacen,
                req.query.idProducto,
            ]);

            return kardex;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }


}

module.exports = Kardex;