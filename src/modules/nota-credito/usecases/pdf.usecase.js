module.exports = ({ conec, firebaseService, axios }) => async function pdf(data) {
    const { idNotaCredito, size, outputType = "pdf" } = data;

    const bucket = firebaseService.getBucket();

    const empresa = await conec.query(`
    SELECT
        documento,
        razonSocial,
        nombreEmpresa,
        rutaLogo,
        tipoEnvio
    FROM 
        empresa`);

    const notaCredito = await conec.query(`
    SELECT 
        DATE_FORMAT(nc.fecha, '%d/%m/%Y') AS fecha, 
        nc.hora,
        nc.idSucursal,
        --
        c.nombre AS comprobante,
        nc.serie,
        nc.numeracion,
        c.facturado,
        --
        cp.documento,
        cp.informacion,
        cp.direccion,
        --
        m.nombre AS moneda,
        m.simbolo,
        m.codiso,
        --
        mt.nombre AS motivo,
        --
        us.informacion AS usuario,
        --
        cv.nombre AS comprobanteVenta,
        v.serie AS serieVenta,
        v.numeracion AS numeracionVenta
    FROM 
        notaCredito AS nc
    INNER JOIN
        comprobante AS c ON c.idComprobante = nc.idComprobante
    INNER JOIN
        persona AS cp ON cp.idPersona = nc.idCliente
    INNER JOIN
        moneda AS m ON m.idMoneda = nc.idMoneda
    INNER JOIN
        motivo AS mt ON mt.idMotivo = nc.idMotivo
    INNER JOIN
        usuario AS u ON u.idUsuario = nc.idUsuario
    INNER JOIN
        persona AS us ON us.idPersona = u.idPersona

    INNER JOIN
        venta AS v ON v.idVenta = nc.idVenta
    INNER JOIN
        comprobante AS cv on cv.idComprobante = v.idComprobante

    WHERE
        nc.idNotaCredito = ?`, [
        idNotaCredito
    ]);

    const sucursal = await conec.query(`
    SELECT 
        s.nombre,
        s.telefono,
        s.celular,
        s.email,
        s.paginaWeb,
        s.direccion,
    
        ub.departamento,
        ub.provincia,
        ub.distrito
    FROM 
        sucursal AS s
    INNER JOIN
        ubigeo AS ub ON ub.idUbigeo = s.idUbigeo
    WHERE 
        s.idSucursal = ?`, [
        notaCredito[0].idSucursal
    ]);

    const detalles = await conec.query(` 
    SELECT 
        ROW_NUMBER() OVER (ORDER BY ncd.idNotaCreditoDetalle ASC) AS id,
        p.codigo,
        p.nombre,
        ncd.cantidad,
        ncd.precio,
        m.nombre AS medida,
        i.idImpuesto,
        i.nombre AS impuesto,
        i.porcentaje
    FROM 
        notaCreditoDetalle AS ncd
    INNER JOIN 
        producto AS p ON p.idProducto = ncd.idProducto
    INNER JOIN 
        medida AS m ON m.idMedida = p.idMedida
    INNER JOIN
        impuesto AS i ON i.idImpuesto = ncd.idImpuesto
    WHERE
        ncd.idNotaCredito = ?
    ORDER BY 
        ncd.idNotaCreditoDetalle ASC`, [
        idNotaCredito
    ]);

    const body = {
        "size": size,
        "outputType": outputType,
        "company": {
            ...empresa[0],
            rutaLogo: empresa[0].rutaLogo ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${empresa[0].rutaLogo}` : null,
        },
        "branch": {
            "nombre": sucursal[0].nombre,
            "telefono": sucursal[0].telefono,
            "celular": sucursal[0].celular,
            "email": sucursal[0].email,
            "paginaWeb": sucursal[0].paginaWeb,
            "direccion": sucursal[0].direccion,
            "ubigeo": {
                "departamento": sucursal[0].departamento,
                "provincia": sucursal[0].provincia,
                "distrito": sucursal[0].distrito
            }
        },
        "creditNote": {
            "fecha": notaCredito[0].fecha,
            "hora": notaCredito[0].hora,
            "nota": notaCredito[0].nota,
            "comprobante": {
                "nombre": notaCredito[0].comprobante,
                "serie": notaCredito[0].serie,
                "numeracion": notaCredito[0].numeracion,
                "facturado": notaCredito[0].facturado
            },
            "cliente": {
                "documento": notaCredito[0].documento,
                "informacion": notaCredito[0].informacion,
                "direccion": notaCredito[0].direccion
            },
            "moneda": {
                "nombre": notaCredito[0].moneda,
                "simbolo": notaCredito[0].simbolo,
                "codiso": notaCredito[0].codiso
            },
            "motivo": {
                "nombre": notaCredito[0].motivo,
            },
            "usuario": {
                "persona": {
                    "informacion": notaCredito[0].usuario
                },
            },
            "venta": {
                "comprobante": {
                    "nombre": notaCredito[0].comprobanteVenta,
                    "serie": notaCredito[0].serieVenta,
                    "numeracion": notaCredito[0].numeracionVenta,
                }
            },
            "notaCreditoDetalles": detalles.map(item => {
                return {
                    "id": item.id,
                    "cantidad": item.cantidad,
                    "precio": item.precio,
                    "producto": {
                        "codigo": item.codigo,
                        "nombre": item.nombre,
                        "medida": {
                            "nombre": item.medida,
                        }
                    },
                    "impuesto": {
                        "idImpuesto": item.idImpuesto,
                        "nombre": item.impuesto,
                        "porcentaje": item.porcentaje,
                    },

                }
            }),
        }
    };

    const options = {
        method: 'POST',
        url: `${process.env.APP_PDF}/credit-note`,
        headers: {
            'Content-Type': 'application/json',
        },
        data: body,
        responseType: 'arraybuffer'
    };

    return await axios.request(options);
}

