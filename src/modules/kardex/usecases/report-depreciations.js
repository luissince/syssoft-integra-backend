const getYear = (date) => {
  if (date instanceof Date) return date.getFullYear();

  const value = String(date);
  const year = value.match(/(?:^|\/)(\d{4})(?:$|\/)/) || value.match(/(\d{4})/);

  return year ? Number(year[1]) : null;
};

module.exports = ({ conec }) => async function reportDepreciacions(data) {
  const fechaInicio = getYear(data.fechaInicio);
  const fechaFinal = getYear(data.fechaFinal);

  if (!fechaInicio || !fechaFinal) {
    throw new Error('fechaInicio y fechaFinal deben contener una fecha válida');
  }

    const result = await conec.query(`
  SELECT
    ad.idProducto,
    ad.serie,
    ad.numeracion,
    ia.correlativo,
    ia.fechaAdquisicion,
    ia.fecha as fechaIngreso,
    ad.periodo,
    ad.dias,
    ia.vidaUtil,
    ad.costoFijo,
    ad.valorInicio,
    ad.enero,
    ad.febrero,
    ad.marzo,
    ad.abril,
    ad.mayo,
    ad.junio,
    ad.julio,
    ad.agosto,
    ad.septiembre,
    ad.octubre,
    ad.noviembre,
    ad.diciembre,
    ad.depreciacion,
    ad.depreciacionAcumulada,
    ad.valorLibros
  FROM 
    activoDepreciacion ad
  INNER JOIN 
    inventarioActivo ia on ia.idInventarioActivo  = ad.idInventarioActivo
  WHERE 
    YEAR(ad.periodo) BETWEEN ? AND ?`, [
    fechaInicio,
    fechaFinal
  ]);

  return result;
}
