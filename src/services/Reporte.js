const { currentTime, currentDate } = require('../tools/Tools');
const { sendPdf, sendError } = require('../tools/Message');
const axios = require('axios').default;
const Conexion = require('../database/Conexion');
const FirebaseService = require('../tools/FiraseBaseService');
const conec = new Conexion();
const firebaseService = new FirebaseService();

class Reporte {
    async generarPreFacturacion(req, res, tipo) {
        try {

            const bucket = firebaseService.getBucket();

            const comprobante = await conec.query(`
            SELECT 
                c.nombre AS comprobante,
                tc.codigo AS codigoVenta,
                c.serie,
                c.numeracion
            FROM 
                comprobante AS c
            INNER JOIN 
                tipoComprobante AS tc ON tc.idTipoComprobante = c.idTipoComprobante
            WHERE
                c.idComprobante = ?`, [
                req.body.idComprobante
            ]);

            const cliente = await conec.query(`
            SELECT 
                td.nombre AS tipoDoc,
                td.codigo AS codigoCliente,
                p.documento,
                p.informacion,
                p.direccion
            FROM 
                persona AS p
            INNER JOIN
                tipoDocumento AS td ON td.idTipoDocumento = p.idTipoDocumento
            WHERE 
                p.idPersona = ?`, [
                req.body.idCliente
            ]);

            const moneda = await conec.query(`
            SELECT 
                m.simbolo,
                m.codiso,
                m.nombre AS moneda
            FROM
                moneda AS m
            WHERE
                m.idMoneda = ?`, [
                req.body.idMoneda
            ]);

            const empresa = await conec.query(`
            SELECT 
                documento,
                razonSocial,
                nombreEmpresa,
                rutaLogo,
                tipoEnvio
            FROM 
                empresa
            LIMIT 
                1`);

            const sucursal = await conec.query(`
                SELECT 
                    s.telefono,
                    s.celular,
                    s.email,
                    s.paginaWeb,
                    s.direccion,
                    u.departamento,
                    u.provincia,
                    u.distrito
                FROM 
                    sucursal AS s
                INNER JOIN
                    ubigeo AS u ON u.idUbigeo = s.idUbigeo
                WHERE
                    s.idSucursal = ?`, [
                req.body.idSucursal
            ]);

            const newEmpresa = {
                ...empresa[0],
                "logoEmpresa": empresa[0].rutaLogo ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${empresa[0].rutaLogo}` : null,
                "logoDesarrollador": `${process.env.APP_URL}/public/logo.png`,
            }

            let detalles = [];
            for (const item of req.body.detalle) {
                const producto = await conec.query(`
                SELECT 
                    p.codigo,
                    p.nombre,
                    m.nombre AS medida,
                    c.nombre AS categoria,
                    pc.valor AS precio 
                FROM 
                    producto AS p 
                INNER JOIN
                    medida AS m ON m.idMedida = p.idMedida
                INNER JOIN 
                    precio AS pc ON p.idProducto = pc.idProducto AND pc.preferido = 1
                INNER JOIN
                    categoria AS c ON c.idCategoria = p.idCategoria
                WHERE 
                    p.idProducto = ?`, [
                    item.idProducto
                ]);

                let cantidad = 0;
                let precio = 0;

                if (item.tipo == "SERVICIO") {
                    precio = item.precio;
                    cantidad = item.cantidad;
                } else {
                    if (item.idTipoTratamientoProducto === 'TT0002') {
                        precio = producto[0].precio;
                        cantidad = item.precio / producto[0].precio;
                    } else {
                        precio = item.precio;
                        cantidad = item.inventarios.reduce((account, item) => account += parseFloat(item.cantidad), 0);
                    }
                }

                const impuesto = await conec.query(`
                SELECT 
                    idImpuesto,
                    nombre,
                    porcentaje 
                FROM 
                    impuesto 
                WHERE 
                    idImpuesto = ?`, [
                    item.idImpuesto
                ]);

                detalles.push({
                    "producto": item.nombreProducto,
                    "medida": producto[0].medida,
                    "categoria": producto[0].categoria,
                    "precio": precio,
                    "cantidad": cantidad,
                    "idImpuesto": impuesto[0].idImpuesto,
                    "impuesto": impuesto[0].nombre,
                    "porcentaje": impuesto[0].porcentaje
                });
            }

            const bancos = await conec.query(`
            SELECT 
                nombre,
                numCuenta,
                cci
            FROM
                banco
            WHERE 
                reporte = 1 AND idSucursal = ?`, [
                req.body.idSucursal
            ]);

            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/api/v1/venta/pre/${tipo}`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    "cabecera": {
                        "idVenta": "VT0001",
                        "comprobante": comprobante[0].comprobante,
                        "codigoVenta": comprobante[0].codigoVenta,
                        "serie": comprobante[0].serie,
                        "numeracion": comprobante[0].numeracion,
                        "idSucursal": "SC0001",
                        "codigoHash": null,
                        "tipoDoc": cliente[0].tipoDoc,
                        "codigoCliente": cliente[0].codigoCliente,
                        "documento": cliente[0].documento,
                        "informacion": cliente[0].informacion,
                        "direccion": cliente[0].direccion,
                        "usuario": "ALEJANDRO MAGNO2",
                        "fecha": currentDate(),
                        "fechaQR": currentDate(),
                        "hora": currentTime(),
                        "idFormaPago": "FP0001",
                        "numeroCuota": 2,
                        "frecuenciaPago": "30",
                        "estado": 1,
                        "simbolo": moneda[0].simbolo,
                        "codiso": moneda[0].codiso,
                        "moneda": moneda[0].moneda,
                        "formaPago": "CONTADO",
                        "comentario": req.body.comentario
                    },
                    "empresa": newEmpresa,
                    "sucursal": sucursal[0],
                    "ventaDetalle": detalles,
                    "cuotas": [],
                    "bancos": bancos
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            sendPdf(res, response.data);
        } catch (error) {
            sendError(res, "Error al obtener el PDF", "Reporte/generarPreFacturacion", error)
        }
    }

}

module.exports = Reporte;