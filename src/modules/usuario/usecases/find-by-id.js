
module.exports = ({ conec }) => async function findById(idUsuario) {
    const result = await conec.query(`
        SELECT 
            u.idUsuario,
            u.idPerfil,
            u.estado,
            u.usuario
        FROM 
            usuario AS u
        WHERE 
            u.idUsuario  = ?`, [
        idUsuario
    ]);
    return result[0];
}
