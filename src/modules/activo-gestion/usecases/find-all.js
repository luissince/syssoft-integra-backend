module.exports = ({ conec }) => async function findAll(data) {
    const {
        opcion,
        buscar,
        posicionPagina,
        filasPorPagina
    } = data;

    const result = await conec.query(`
    SELECT 
        aa.idAsignacionActivo,
        aa.idDocumentoActivo,
        aa.idPersona,
        aa.documentoPdf,
        td.nombre AS documento,
        P.documento AS numeroDocumento,
        P.informacion AS responsable,
        da.tipo,
        aa.fecha,
        aa.hora,
        aa.idUsuario
    FROM 
        asignacionactivo aa
    JOIN 
    	persona p ON p.idPersona = aa.idPersona
   	JOIN
    	tipodocumento td ON td.idTipoDocumento = p.idTipoDocumento
    LEFT JOIN
    	documentoactivo da ON da.idDocumentoActivo = aa.idDocumentoActivo
    WHERE 
        ? = 0
    OR
        ? = 1 AND (P.informacion like concat(?,'%'))
    GROUP BY 
    	aa.idAsignacionActivo,
        aa.idDocumentoActivo,
        aa.idPersona,
        aa.documentoPdf,
        td.nombre,
        P.documento,
        P.informacion,
        da.tipo,
        aa.fecha,
        aa.hora,
        aa.idUsuario
    LIMIT 
        ?, ?`,[
        parseInt(opcion),
        parseInt(opcion),
        buscar,
        parseInt(posicionPagina),
        parseInt(filasPorPagina)
    ]);

    const newResult = await Promise.all(result.map(async (item, index) => {
        const gestionDetalle = await conec.query(`
        SELECT 
            pr.nombre AS producto,
            pr.imagen,
            pr.codigo,
            pr.sku,
            dd.cantidad,
            ca.nombre AS categoria,
            ia.serie,
            u.descripcion AS ubicacion
        FROM 
            documentoactivodetalle dd
        LEFT JOIN 
        	inventarioActivo ia ON ia.idInventarioActivo = dd.idInventarioActivo
        JOIN 
        	inventario i ON i.idInventario = ia.idInventario
        JOIN
        	producto pr ON pr.idProducto = i.idProducto
        JOIN
        	categoria ca ON ca.idCategoria = pr.idCategoria
        LEFT JOIN
            ubicacion u ON u.idUbicacion = ia.idUbicacion
        WHERE 
            dd.idDocumentoActivo = ?`, [
            item.idDocumentoActivo
        ]);

        return {
            ...item,
            id: (index + 1) + parseInt(posicionPagina),
            gestionDetalle: gestionDetalle
        }
    }));

    const total = await conec.query(`SELECT 
        COUNT(*) AS Total
    FROM 
        asignacionactivo aa
    JOIN 
    	persona p ON p.idPersona = aa.idPersona
   	JOIN
    	tipodocumento td ON td.idTipoDocumento = p.idTipoDocumento
    LEFT JOIN
    	documentoactivo da ON da.idDocumentoActivo = aa.idDocumentoActivo
    WHERE 
        ? = 0
    OR
        ? = 1 AND (P.informacion like concat(?,'%'))`, [
        parseInt(opcion),
        parseInt(opcion),
        buscar,
    ]);

    return { "result": newResult, "total": total[0].Total };
}