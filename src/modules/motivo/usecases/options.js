module.exports = ({ conec }) => async function options(data) {
    const result = await conec.query(`
        SELECT 
            idMotivo, 
            nombre 
        FROM 
            motivo 
        WHERE 
            estado = 1`);

    return result;
}