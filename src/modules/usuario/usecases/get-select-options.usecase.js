
module.exports = ({ conec }) => async function getSelectOptions() {
    const result = await conec.query(`
        SELECT 
            u.idUsuario,
            p.informacion
        FROM 
            usuario AS u
        JOIN 
            persona AS p ON u.idPersona = p.idPersona
        WHERE 
            u.estado = 1`);
    return result;
}
