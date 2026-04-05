module.exports = ({ conec }) => async function findAll(data) {
    const {
        opcion,
        buscar,
        posicionPagina,
        filasPorPagina
    } = data;

    const list = await conec.query(`
        SELECT 
            idCargo, 
            nombre,
            descripcion,
            estado,
            fecha,
            hora,
            idUsuario
        FROM 
            cargo 
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

    const resultLista = list.map(function (item, index) {
        return {
            ...item,
            id: (index + 1) + parseInt(posicionPagina)
        }
    });

    const total = await conec.query(`
    SELECT 
        COUNT(*) AS Total 
    FROM 
        cargo  
    WHERE 
        ? = 0
    OR
        ? = 1 AND (nombre LIKE CONCAT(?,'%'))`, [
        parseInt(opcion),

        parseInt(opcion),
        buscar,
        buscar,
    ]);

    return { "result": resultLista, "total": total[0].Total };
}