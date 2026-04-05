module.exports = ({ conec }) => async function findAll(data) {
    const {
        opcion,
        buscar,
        posicionPagina,
        filasPorPagina
    } = data;

    const list = await conec.query(`
    SELECT 
        idArea, 
        nombre,
        descripcion,
        estado,
        fecha,
        hora,
        idUsuario
    FROM 
        area 
    WHERE 
        ? = 0
    OR
        ? = 1 AND (nombre like concat(?,'%'))
    LIMIT 
        ?,?`, [
        parseInt(opcion),
        parseInt(opcion),
        buscar,
        parseInt(posicionPagina),
        parseInt(filasPorPagina)
    ])

    const resultList = list.map(function (item, index) {
        return {
            ...item,
            id: (index + 1) + parseInt(posicionPagina)
        }
    });

    const total = await conec.query(`
    SELECT 
        COUNT(*) AS Total 
    FROM 
        area  
    WHERE 
        ? = 0
    OR
        ? = 1 AND (nombre like concat(?,'%'))`, [
        parseInt(opcion),
        parseInt(opcion),
        buscar,
        buscar,
    ]);

    return { "result": resultList, "total": total[0].Total };
}