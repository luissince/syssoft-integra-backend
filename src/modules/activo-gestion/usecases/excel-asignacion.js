const ExcelJS = require('exceljs');

module.exports = ({ conec }) => async function excelAsignacion(data) {

  console.log(data);

  const fechaInicio = data.fechaInicio;
  const fechaFinal = data.fechaFinal;

  if (!fechaInicio || !fechaFinal) {
    throw new Error('fechaInicio y fechaFinal deben contener una fecha válida');
  }

  const result = await conec.query(`
    SELECT 
        da.idDocumentoActivo, 
        p.documento, 
        td.nombre AS tipoDocumento, 
        p.informacion AS persona, 
        p.email, 
        p.celular, 
        p.telefono,
        da.fecha,
        da.hora, 
        dd.cantidad, 
        ia.serie,  
        ia.estado, 
        u.descripcion AS ubicacion, 
        m.descripcion AS marca, 
        ia.correlativo, 
        prd.nombre AS producto, 
        prd.codigo 
    FROM documentoActivo da

    INNER JOIN documentoActivoDetalle dd 
        ON dd.idDocumentoActivo = da.idDocumentoActivo

    INNER JOIN inventarioActivo ia 
        ON ia.idInventarioActivo = dd.idInventarioActivo

    INNER JOIN inventario i 
        ON i.idInventario = ia.idInventario

    INNER JOIN producto prd 
        ON prd.idProducto = i.idProducto

    INNER JOIN persona p 
        ON p.idPersona = da.idPersona

    INNER JOIN tipoDocumento td 
        ON td.idTipoDocumento = p.idTipoDocumento 

    LEFT JOIN ubicacion u 
        ON u.idUbicacion = ia.idUbicacion

    LEFT JOIN marca m 
        ON m.idMarca = ia.idMarca

    WHERE da.fecha BETWEEN ? AND ?`, [
    fechaInicio,
    fechaFinal
  ]);

  // --------------------------------------------------
  // EXCEL
  // --------------------------------------------------

  const workbook = new ExcelJS.Workbook();

  workbook.creator = 'Sistema';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Asignaciones');

  // Columnas
  worksheet.columns = [
    {
      header: 'N°',
      key: 'numero',
      width: 8
    },
    {
      header: 'DNI/RUC',
      key: 'documento',
      width: 20
    },
    {
      header: 'Persona',
      key: 'persona',
      width: 30
    },
    {
      header: 'Cel. / Tel.',
      key: 'contacto',
      width: 20
    },
    {
      header: 'Email',
      key: 'email',
      width: 35
    },
    {
      header: 'Producto',
      key: 'producto',
      width: 35
    },
    {
      header: 'Serie',
      key: 'serie',
      width: 20
    },
    {
      header: 'Correlativo',
      key: 'correlativo',
      width: 18
    },
    {
      header: 'Marca',
      key: 'marca',
      width: 20
    },
    {
      header: 'Estado',
      key: 'estado',
      width: 20
    },
    {
      header: 'Ubicación',
      key: 'ubicacion',
      width: 25
    },
    {
      header: 'Fecha',
      key: 'fecha',
      width: 15
    }
  ];

  // --------------------------------------------------
  // ESTILO DEL HEADER
  // --------------------------------------------------

  const headerRow = worksheet.getRow(1);

  headerRow.height = 25;

  headerRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: {
        argb: 'FFFFFF'
      }
    };

    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: '4472C4'
      }
    };

    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true
    };

    cell.border = {
      top: {
        style: 'thin'
      },
      left: {
        style: 'thin'
      },
      bottom: {
        style: 'thin'
      },
      right: {
        style: 'thin'
      }
    };
  });

  // --------------------------------------------------
  // DATOS
  // --------------------------------------------------

  result.forEach((activo, idx) => {

    const row = worksheet.addRow({
      numero: idx + 1,

      documento: `${activo.tipoDocumento || ''}\n${activo.documento || ''}`,

      persona: activo.persona || '',

      contacto: [
        activo.celular,
        activo.telefono
      ]
        .filter(Boolean)
        .join('\n'),

      email: activo.email || '',

      producto: `${activo.codigo || ''}\n${activo.producto || ''}`,

      serie: activo.serie || '',

      correlativo: activo.correlativo || '',

      marca: activo.marca ?? 'N/A',

      estado: activo.estado || '',

      ubicacion: activo.ubicacion || '',

      fecha: activo.fecha
        ? new Date(activo.fecha)
        : null
    });

    // Altura de fila para los campos con salto de línea
    row.height = 35;

    row.eachCell((cell) => {

      cell.alignment = {
        vertical: 'middle',
        wrapText: true
      };

      cell.border = {
        top: {
          style: 'thin',
          color: {
            argb: 'D9D9D9'
          }
        },
        left: {
          style: 'thin',
          color: {
            argb: 'D9D9D9'
          }
        },
        bottom: {
          style: 'thin',
          color: {
            argb: 'D9D9D9'
          }
        },
        right: {
          style: 'thin',
          color: {
            argb: 'D9D9D9'
          }
        }
      };
    });

    // Formato de fecha
    row.getCell('fecha').numFmt = 'dd/mm/yyyy';

  });

  // --------------------------------------------------
  // CONGELAR HEADER
  // --------------------------------------------------

  worksheet.views = [
    {
      state: 'frozen',
      ySplit: 1
    }
  ];

  // --------------------------------------------------
  // FILTROS
  // --------------------------------------------------

  worksheet.autoFilter = {
    from: 'A1',
    to: 'L1'
  };

  // --------------------------------------------------
  // RESPONDER EXCEL
  // --------------------------------------------------

  return workbook;
};