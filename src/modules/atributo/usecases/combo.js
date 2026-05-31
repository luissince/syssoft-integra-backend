module.exports = ({ conec }) => async function combo(data) {
    const { idTipoAtributo } = data;

    const result = await conec.query(`
    SELECT 
        a.idAtributo,
        a.idTipoAtributo,
        a.nombre,

        ta.nombre AS nombreTipoAtributo 
    FROM 
        atributo AS a
    LEFT JOIN 
        tipoAtributo AS ta ON a.idTipoAtributo = ta.idTipoAtributo
    WHERE 
        a.estado = 1`
    );

    return result;
};