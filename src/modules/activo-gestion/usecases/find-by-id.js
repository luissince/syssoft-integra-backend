module.exports = ({ conec }) => async function findById(data) {
  const { idArea } = data;

  const result = await conec.query(`
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
    idArea = ?`, [
    idArea
  ]);

  return result[0];
}