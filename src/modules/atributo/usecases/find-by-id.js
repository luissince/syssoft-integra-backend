module.exports = ({ conec }) => async function findById(data) {
  const { idAtributo } = data;

  const result = await conec.query(`
  SELECT
    idAtributo,
    idTipoAtributo,
    nombre,
    hexadecimal,
    valor,
    estado
  FROM 
    atributo 
  WHERE 
    idAtributo = ?`, [
    idAtributo
  ]);

  return result[0];
}