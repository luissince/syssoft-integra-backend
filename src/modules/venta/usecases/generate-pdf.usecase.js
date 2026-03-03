module.exports = ({ conec, firebaseService, axios }) => async function generatePdf(data) {
    const { idVenta, size, outputType = "pdf" } = data;

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

    const venta = await conec.query(`
    SELECT 
        DATE_FORMAT(v.fecha, '%d/%m/%Y') AS fecha, 
        v.hora,
        v.idSucursal,
        v.nota,
        --
        c.nombre AS comprobante,
        v.serie,
        v.numeracion,
        c.facturado,
        --
        cp.documento,
        cp.informacion,
        cp.direccion,
        --
        fp.nombre AS formaPago,
        pl.nombre AS plazo,
        IFNULL(DATE_FORMAT(v.fechaVencimiento, '%d/%m/%Y') , '') AS fechaVencimiento,
        --
        m.nombre AS moneda,
        m.simbolo,
        m.codiso,
        --
        us.informacion as usuario
    FROM 
        venta AS v
    INNER JOIN
        comprobante AS c ON c.idComprobante = v.idComprobante
    INNER JOIN
        persona AS cp ON cp.idPersona = v.idCliente
    INNER JOIN
        moneda AS m ON m.idMoneda = v.idMoneda
    INNER JOIN
        usuario AS u ON u.idUsuario = v.idUsuario
    INNER JOIN
        persona AS us ON us.idPersona = u.idPersona
    INNER JOIN
        formaPago AS fp ON fp.idFormaPago = v.idFormaPago
    LEFT JOIN
        plazo as pl ON pl.idPlazo = v.idPlazo
    WHERE 
        v.idVenta = ?`, [
        idVenta
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
        venta[0].idSucursal
    ]);

    const detalles = await conec.query(` 
    SELECT 
        ROW_NUMBER() OVER (ORDER BY gd.idVentaDetalle ASC) AS id,
        p.codigo,
        p.nombre,
        gd.cantidad,
        gd.precio,
        m.nombre AS medida,
        i.idImpuesto,
        i.nombre AS impuesto,
        i.porcentaje
    FROM 
        ventaDetalle AS gd
    INNER JOIN 
        producto AS p ON gd.idProducto = p.idProducto
    INNER JOIN 
        medida AS m ON m.idMedida = p.idMedida
    INNER JOIN
        impuesto AS i ON i.idImpuesto = gd.idImpuesto
    WHERE 
        gd.idVenta = ?
    ORDER BY 
        gd.idVentaDetalle ASC`, [
        idVenta
    ]);

    const bancos = await conec.query(`
    SELECT 
        nombre,
        numCuenta,
        cci
    FROM
        banco
    WHERE 
        reporte = 1 AND idSucursal = ?`, [
        venta[0].idSucursal
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
        "sale": {
            "fecha": venta[0].fecha,
            "hora": venta[0].hora,
            "nota": venta[0].nota,
            "comprobante": {
                "nombre": venta[0].comprobante,
                "serie": venta[0].serie,
                "numeracion": venta[0].numeracion,
                "facturado": venta[0].facturado
            },
            "cliente": {
                "documento": venta[0].documento,
                "informacion": venta[0].informacion,
                "direccion": venta[0].direccion
            },
            "formaPago": {
                "nombre": venta[0].formaPago
            },
            "plazo": !venta[0].plazo ? null : {
                "nombre": venta[0].plazo,
            },
            "fechaVencimiento": venta[0].fechaVencimiento,
            "moneda": {
                "nombre": venta[0].moneda,
                "simbolo": venta[0].simbolo,
                "codiso": venta[0].codiso
            },
            "usuario": {
                "persona": {
                    "informacion": venta[0].usuario
                },
            },
            "ventaDetalles": detalles.map(item => {
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
        },
        "banks": bancos
    };

     const options = {
        method: 'POST',
        url: `${process.env.APP_PDF}/sale/pdf/invoices`,
        headers: {
            'Content-Type': 'application/json',
        },
        data: body,
        responseType: 'arraybuffer'
    };

    return await axios.request(options);
}