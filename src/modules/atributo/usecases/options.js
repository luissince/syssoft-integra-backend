module.exports = ({ conec }) => async function options(data) {
    const { idTipoAtributo } = data;

    const result = await conec.query(`
    SELECT 
        idAtributo,
        idTipoAtributo,
        nombre,
        hexadecimal,
        valor
    FROM 
        atributo 
    WHERE 
        estado = 1 AND idTipoAtributo = ?`, [
        idTipoAtributo
    ]);

    return result;
}