module.exports = ({ conec }) => async function findById(data) {
    const { idCargo } = data;
    
    const result = await conec.query(`
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
      idCargo = ?`, [
        idCargo
    ]);

    return result[0];
}