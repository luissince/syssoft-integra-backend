const getYear = (date) => {
  if (date instanceof Date) return date.getFullYear();

  const value = String(date);
  const year = value.match(/(?:^|\/)(\d{4})(?:$|\/)/) || value.match(/(\d{4})/);

  return year ? Number(year[1]) : null;
};

module.exports = ({ conec }) => async function reportAsignacion(data) {
  const fechaInicio = data.fechaInicio;
  const fechaFinal = data.fechaFinal;

  if (!fechaInicio || !fechaFinal) {
    throw new Error('fechaInicio y fechaFinal deben contener una fecha válida');
  }

    const result = await conec.query(`
  SELECT 
    da.idDocumentoActivo, 
    p.documento, 
    td.nombre as tipoDocumento, 
    p.informacion as persona, 
    p.email, 
    p.celular, 
    da.fecha,
    da.hora, 
    dd.cantidad, 
    ia.serie,  
    ia.estado, 
    u.descripcion 
    as ubicacion, 
    m.descripcion as marca, 
    ia.correlativo, 
    prd.nombre as producto, 
    prd.codigo 
  FROM 
    documentoActivo da
  INNER JOIN 
    documentoActivoDetalle dd on dd.idDocumentoActivo = da.idDocumentoActivo
  INNER JOIN 
    inventarioActivo ia on ia.idInventarioActivo = dd.idInventarioActivo
  INNER JOIN 
    inventario i on i.idInventario = ia.idInventario
  INNER JOIN 
    producto prd on prd.idProducto = i.idProducto
  INNER JOIN 
    persona p on p.idPersona = da.idPersona
  INNER JOIN 
    tipoDocumento td on td.idTipoDocumento = p.idTipoDocumento 
  LEFT JOIN 
    ubicacion u on u.idUbicacion = ia.idUbicacion
  LEFT JOIN 
    marca m on m.idMarca = ia.idMarca
  WHERE 
    da.fecha BETWEEN ? AND ?`, [
    fechaInicio,
    fechaFinal
  ]);

  return result;
}
