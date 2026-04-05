module.exports = ({ conec }) => async function options() {
    const result = await conec.query(`
    SELECT 
        idArea, 
        nombre
    FROM 
        area`);

    return result;
}