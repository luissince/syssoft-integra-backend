module.exports = ({ conec }) => async function options() {
    const result = await conec.query(`
    SELECT 
        idCargo, 
        nombre
    FROM 
        cargo`);

    return result;
}