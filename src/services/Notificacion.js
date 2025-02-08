const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Notificacion {

    async list() {
        try {
            const result = await conec.query(`
            SELECT 
                v.serie,
                co.nombre,
                CASE v.estado
                    WHEN 3 THEN 'DAR DE BAJA'
                    ELSE 'POR DECLARAR' 
                END AS 'estado',
                COUNT(v.serie) AS 'cantidad'
            FROM venta AS v 
            INNER JOIN 
                comprobante AS co  ON co.idComprobante = v.idComprobante AND co.facturado = 1 
            WHERE 
                IFNULL(v.xmlSunat,'') <> '0' AND IFNULL(v.xmlSunat,'') <> '1032'
                OR
                IFNULL(v.xmlSunat,'') = '0' AND v.estado = 3
            --
            GROUP BY 
            v.serie,
            co.nombre
            --
            UNION
            --
            SELECT 
                gr.serie,
                co.nombre,
                CASE gr.estado
                    WHEN 3 THEN 'DAR DE BAJA'
                    ELSE 'POR DECLARAR' 
                END AS 'estado',
                COUNT(gr.serie) AS 'cantidad'
            FROM guiaRemision AS gr 
            INNER JOIN comprobante AS co  ON co.idComprobante = gr.idComprobante AND co.facturado = 1 
            WHERE 
            IFNULL(gr.xmlSunat,'') <> '0' AND IFNULL(gr.xmlSunat,'') <> '1032'
            OR
            IFNULL(gr.xmlSunat,'') = '0' AND gr.estado = 3

            GROUP BY 
            gr.serie,
            co.nombre`);
            return result;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async detail(req) {
        try {
            const lista = await conec.query(`
            SELECT 
                v.idVenta AS idComprobante,
                v.fecha AS fechaOrder,
                DATE_FORMAT(v.fecha, '%d/%m/%Y') AS fecha, 
                v.hora,        
                co.nombre AS comprobante,
                v.serie,
                v.numeracion,
                v.estado, 
                'fac' AS tipo
            FROM 
                venta AS v 
                INNER JOIN comprobante AS co ON v.idComprobante = co.idComprobante AND co.facturado = 1
                INNER JOIN tipoComprobante AS tc ON tc.idTipoComprobante = co.idTipoComprobante      
            WHERE 
                IFNULL(v.xmlSunat,'') <> '0' AND IFNULL(v.xmlSunat,'') <> '1032'
                OR
                IFNULL(v.xmlSunat,'') = '0' AND v.estado = 3
            --
            UNION ALL
            --
            SELECT 
                gu.idGuiaRemision AS idComprobante,
                gu.fecha AS fechaOrder,
                DATE_FORMAT(gu.fecha, '%d/%m/%Y') AS fecha, 
                gu.hora,         
                co.nombre AS comprobante,
                gu.serie,
                gu.numeracion,
                gu.estado,   
                'guia' AS tipo      
            FROM 
                guiaRemision AS gu 
                INNER JOIN comprobante AS co ON gu.idComprobante = co.idComprobante AND co.facturado = 1
                INNER JOIN tipoComprobante AS tc ON tc.idTipoComprobante = co.idTipoComprobante     
            WHERE 
                IFNULL(gu.xmlSunat,'') <> '0' AND IFNULL(gu.xmlSunat,'') <> '1032'
                OR
                IFNULL(gu.xmlSunat,'') = '0' AND gu.estado = 3
                
            ORDER BY fechaOrder DESC, hora DESC

            LIMIT ?,?`, [
                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.query(`
            SELECT 
                COUNT(*) AS Total
            FROM (
                SELECT 
                    v.idVenta AS idComprobante
                FROM 
                    venta AS v 
                    INNER JOIN comprobante AS co ON v.idComprobante = co.idComprobante AND co.facturado = 1
                    INNER JOIN tipoComprobante AS tc ON tc.idTipoComprobante = co.idTipoComprobante      
                WHERE 
                    IFNULL(v.xmlSunat,'') <> '0' AND IFNULL(v.xmlSunat,'') <> '1032'
                    OR
                    IFNULL(v.xmlSunat,'') = '0' AND v.estado = 3
                --
                UNION
                --
                SELECT 
                    gu.idGuiaRemision AS idComprobante     
                FROM 
                    guiaRemision AS gu 
                    INNER JOIN comprobante AS co ON gu.idComprobante = co.idComprobante AND co.facturado = 1
                    INNER JOIN tipoComprobante AS tc ON tc.idTipoComprobante = co.idTipoComprobante     
                WHERE 
                    IFNULL(gu.xmlSunat,'') <> '0' AND IFNULL(gu.xmlSunat,'') <> '1032'
                    OR
                    IFNULL(gu.xmlSunat,'') = '0' AND gu.estado = 3
            ) AS SubqueryAlias`);

            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }


}

module.exports = Notificacion;