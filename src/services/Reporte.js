const { dateFormat, registerLog, currentTime, currentDate } = require('../tools/Tools');
const xl = require('excel4node');
const { sendPdf, sendError, sendClient, sendSuccess } = require('../tools/Message');
require('dotenv').config();
const axios = require('axios').default;
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Reporte {

    async generarFacturacion(req, res, tipo) {
        try {
            const venta = await conec.query(`
            SELECT
                v.idVenta, 
                com.nombre AS comprobante,
                com.codigo as codigoVenta,
                v.serie,
                v.numeracion,
                v.idSucursal,
                v.codigoHash,
                td.nombre AS tipoDoc,      
                td.codigo AS codigoCliente,      
                c.documento,
                c.informacion,
                c.direccion,
                CONCAT(us.nombres,' ',us.apellidos) AS usuario,
                DATE_FORMAT(v.fecha,'%Y-%m-%d') as fecha,
                DATE_FORMAT(v.fecha,'%Y-%m-%d') as fechaQR,
                v.hora, 
                v.idFormaPago,
                v.numeroCuota,
                v.frecuenciaPago,
                v.estado, 
                m.simbolo,
                m.codiso,
                m.nombre as moneda,
                p.nombre as formaPago
            FROM 
                venta AS v 
            INNER JOIN 
                persona AS c ON v.idCliente = c.idPersona
            INNER JOIN 
                usuario AS us ON us.idUsuario = v.idUsuario 
            INNER JOIN 
                tipoDocumento AS td ON td.idTipoDocumento = c.idTipoDocumento 
            INNER JOIN 
                comprobante AS com ON v.idComprobante = com.idComprobante
            INNER JOIN 
                moneda AS m ON m.idMoneda = v.idMoneda
            INNER JOIN 
                formaPago AS p ON p.idFormaPago = v.idFormaPago
            WHERE 
                v.idVenta = ?`, [
                req.params.idVenta
            ]);

            const detalle = await conec.query(`
            SELECT 
                p.nombre AS producto,
                md.nombre AS medida, 
                m.nombre AS categoria, 
                vd.precio,
                vd.cantidad,
                vd.idImpuesto,
                imp.nombre AS impuesto,
                imp.porcentaje
            FROM 
                ventaDetalle AS vd 
            INNER JOIN 
                producto AS p ON vd.idProducto = p.idProducto 
            INNER JOIN 
                medida AS md ON md.idMedida = p.idMedida 
            INNER JOIN 
                categoria AS m ON p.idCategoria = m.idCategoria 
            INNER JOIN 
                impuesto AS imp ON vd.idImpuesto  = imp.idImpuesto  
            WHERE 
                vd.idVenta = ?`, [
                req.params.idVenta
            ])

            const plazos = await conec.query(`
            SELECT 
                cuota,
                DATE_FORMAT(fecha,'%Y-%m-%d') as fecha,
                monto
            FROM 
                plazo 
            WHERE 
                idVenta = ?`, [
                req.params.idVenta
            ]);

            const bancos = await conec.query(`
            SELECT 
                nombre,
                numCuenta,
                cci
            FROM
                banco
            WHERE 
                reporte = 1
            `);

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
                venta[0].idSucursal
            ]);

            const newEmpresa = {
                ...empresa[0],
                "logoEmpresa": `${process.env.APP_URL}/files/company/${empresa[0].rutaLogo}`,
                "logoDesarrollador": `${process.env.APP_URL}/files/to/logo.png`,
            }

            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/api/v1/venta/${tipo}`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    cabecera: venta[0],
                    empresa: newEmpresa,
                    sucursal: sucursal[0],
                    ventaDetalle: detalle,
                    plazos: plazos,
                    bancos: bancos
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            sendPdf(res, response.data);
        } catch (error) {
            registerLog('Reporte/generarFacturacion:', error);
            sendError(res, "Error al obtener el PDF")
        }
    }

    async generarPreFacturacion(req, res, tipo) {
        try {

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
                "logoEmpresa": `${process.env.APP_URL}/files/company/${empresa[0].rutaLogo}`,
                "logoDesarrollador": `${process.env.APP_URL}/files/to/logo.png`,
            }

            let detalles = [];
            for (const item of req.body.detalle) {
                const producto = await conec.query(`
                SELECT 
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
                reporte = 1
            `);


            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/api/v1/venta/${tipo}`,
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
                        "formaPago": "CONTADO"
                    },
                    "empresa": newEmpresa,
                    "sucursal": sucursal[0],
                    "ventaDetalle": detalles,
                    "plazos": [],
                    "bancos": bancos
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            sendPdf(res, response.data);
        } catch (error) {
            registerLog('Reporte/generarFacturacion:', error);
            sendError(res, "Error al obtener el PDF")
        }
    }

    async generarCotizacion(req, res, tipo) {
        try {

            const cotizacion = await conec.query(`
            SELECT 
                serie,
                numeracion,
                DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, 
                hora,
                idSucursal,
                idMoneda,
                idCliente,
                idComprobante
            FROM 
                cotizacion 
            WHERE 
                idCotizacion = ?`, [
                req.params.idCotizacion
            ])

            const cliente = await conec.query(`
            SELECT 
                p.documento,
                p.informacion,
                p.direccion
            FROM 
                persona AS p
            WHERE 
                p.idPersona = ?
            `, [
                cotizacion[0].idCliente
            ]);

            const moneda = await conec.query(`
            SELECT 
                nombre,
                simbolo,
                codiso
            FROM 
                moneda AS m
            WHERE 
                m.idMoneda = ?`, [
                cotizacion[0].idMoneda
            ])

            const comprobante = await conec.query(`
            SELECT 
                nombre
            FROM 
                comprobante AS c
            WHERE 
                c.idComprobante = ?`, [
                cotizacion[0].idComprobante
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

            const newEmpresa = {
                ...empresa[0],
                "logoEmpresa": `${process.env.APP_URL}/files/company/${empresa[0].rutaLogo}`,
                "logoDesarrollador": `${process.env.APP_URL}/files/to/logo.png`,
            }

            const bancos = await conec.query(`
            SELECT 
                nombre,
                numCuenta,
                cci
            FROM
                banco
            WHERE 
                reporte = 1
            `);


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
                cotizacion[0].idSucursal
            ]);


            const detalle = await conec.query(`
            SELECT 
                cd.precio,
                cd.cantidad,
                cd.idImpuesto,
                p.nombre AS producto,
                m.nombre AS medida,
                i.nombre AS impuesto,
                i.porcentaje
            FROM 
                cotizacionDetalle AS cd
            INNER JOIN
                producto AS p ON p.idProducto = cd.idProducto
            INNER JOIN
                medida AS m ON m.idMedida = cd.idMedida
            INNER JOIN
                impuesto AS i ON i.idImpuesto = cd.idImpuesto
            WHERE 
                cd.idCotizacion = ?`, [
                req.params.idCotizacion
            ]);

            const detalles = detalle.map((item) => {
                return {
                    "precio": item.precio,
                    "cantidad": item.cantidad,
                    "idImpuesto": item.idImpuesto,
                    "producto": {
                        "nombre": item.producto
                    },
                    "medida": {
                        "nombre": item.medida
                    },
                    "impuesto": {
                        "nombre": item.impuesto,
                        "porcentaje": item.porcentaje,
                    }
                }
            });

            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/api/v1/cotizacion/${tipo}`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    "serie": cotizacion[0].serie,
                    "numeracion": cotizacion[0].numeracion,
                    "fecha": cotizacion[0].fecha,
                    "hora": cotizacion[0].hora,
                    "moneda": moneda[0],
                    "persona": cliente[0],
                    "comprobante": comprobante[0],
                    "empresa": newEmpresa,
                    "sucursal": sucursal[0],
                    "cotizacionDetalle": detalles,
                    "bancos": bancos
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            sendPdf(res, response.data);
        } catch (error) {
            registerLog('Reporte/generarCotizacion:', error);
            sendError(res, "Error al obtener el PDF")
        }
    }

    async generarPreCotizacion(req, res, tipo) {
        try {

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

            const newEmpresa = {
                ...empresa[0],
                "logoEmpresa": `${process.env.APP_URL}/files/company/${empresa[0].rutaLogo}`,
                "logoDesarrollador": `${process.env.APP_URL}/files/to/logo.png`,
            }

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

            const cliente = await conec.query(`
            SELECT 
                p.documento,
                p.informacion,
                p.direccion
            FROM 
                persona AS p
            WHERE 
                p.idPersona = ?
            `, [
                req.body.idCliente
            ]);

            const comprobante = await conec.query(`
            SELECT 
                nombre
            FROM 
                comprobante AS c
            WHERE 
                c.idComprobante = ?`, [
                req.body.idComprobante
            ]);

            const moneda = await conec.query(`
            SELECT 
                nombre,
                simbolo,
                codiso
            FROM 
                moneda AS m
            WHERE 
                m.idMoneda = ?`, [
                req.body.idMoneda
            ])

            const detalles = [];

            for (const item of req.body.detalle) {
                const medida = await conec.query(`
                SELECT 
                    nombre
                FROM 
                    medida AS m
                WHERE 
                    m.idMedida = ?`, [
                    item.idMedida
                ]);

                detalles.push({
                    "precio": item.precio,
                    "cantidad": item.cantidad,
                    "idImpuesto": item.idImpuesto,
                    "producto": {
                        "nombre": item.nombre
                    },
                    "medida": {
                        "nombre": medida[0].nombre
                    },
                    "impuesto": {
                        "nombre": item.nombreImpuesto,
                        "porcentaje": item.porcentajeImpuesto,
                    }
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
                reporte = 1
            `);

            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/api/v1/cotizacion/${tipo}`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    "serie": "CT01",
                    "numeracion": 1,
                    "fecha": currentDate(),
                    "hora": currentTime(),
                    "moneda": moneda[0],
                    "persona": cliente[0],
                    "comprobante": comprobante[0],
                    "empresa": newEmpresa,
                    "sucursal": sucursal[0],
                    "cotizacionDetalle": detalles,
                    "bancos": bancos
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            sendPdf(res, response.data);
        } catch (error) {
            registerLog('Reporte/generarPreCotizacion:', error);
            sendError(res, "Error al obtener el PDF")
        }
    }

    async generarGuiaRemision(req, res, tipo) {
        try {
            const guiaRemision = await conec.query(`
            SELECT
                gui.idSucursal,
                DATE_FORMAT(gui.fecha,'%d/%m/%Y') AS fecha,
                gui.hora,
                cgui.nombre AS comprobante,
                gui.serie,
                gui.numeracion,
                mdt.nombre AS modalidadTraslado,
                mvt.nombre AS motivoTraslado,
                DATE_FORMAT(gui.fechaTraslado,'%d/%m/%Y') AS fechaTraslado,
                tp.nombre AS tipoPeso,
                gui.peso,
                vh.marca,
                vh.numeroPlaca,
                cd.documento AS documentoConductor,
                cd.informacion AS informacionConductor,
                cd.licenciaConducir,
                gui.direccionPartida,
                CONCAT(up.departamento,' - ',up.provincia,' - ',up.distrito, '(',up.ubigeo,')') AS ubigeoPartida,
                gui.direccionLlegada,
                CONCAT(ul.departamento,' - ',ul.provincia,' - ',ul.distrito, '(',ul.ubigeo,')') AS ubigeoLlegada,
                CONCAT(u.apellidos,', ',  u.nombres) AS usuario,
                cv.nombre AS comprobanteRef,
                v.serie AS serieRef,
                v.numeracion AS numeracionRef,
                cl.documento AS documentoCliente,
                cl.informacion AS informacionCliente,
                gui.codigoHash
            FROM
                guiaRemision AS gui
            INNER JOIN 
                comprobante AS cgui on cgui.idComprobante = gui.idComprobante
            INNER JOIN 
                modalidadTraslado AS mdt ON mdt.idModalidadTraslado = gui.idModalidadTraslado
            INNER JOIN 
                motivoTraslado AS mvt ON mvt.idMotivoTraslado = gui.idMotivoTraslado
            INNER JOIN 
                tipoPeso AS tp ON tp.idTipoPeso = gui.idTipoPeso
            INNER JOIN 
                vehiculo AS vh ON vh.idVehiculo = gui.idVehiculo
            INNER JOIN 
                persona AS cd ON cd.idPersona = gui.idConductor
            INNER JOIN 
                ubigeo AS up ON up.idUbigeo = gui.idUbigeoPartida
            INNER JOIN 
                ubigeo AS ul ON ul.idUbigeo = gui.idUbigeoLlegada
            INNER JOIN 
                usuario AS u ON u.idUsuario = gui.idUsuario
            INNER JOIN 
                venta AS v ON v.idVenta = gui.idVenta
            INNER JOIN 
                comprobante AS cv on cv.idComprobante = v.idComprobante
            INNER JOIN 
                persona AS cl ON cl.idPersona = v.idCliente
            WHERE 
                gui.idGuiaRemision = ?`, [
                req.params.idGuiaRemision
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
                guiaRemision[0].idSucursal
            ]);

            const newEmpresa = {
                ...empresa[0],
                "logoEmpresa": `${process.env.APP_URL}/files/company/${empresa[0].rutaLogo}`,
                "logoDesarrollador": `${process.env.APP_URL}/files/to/logo.png`,
            }

            const detalles = await conec.query(` 
            SELECT 
                p.codigo,
                p.nombre,
                gd.cantidad,
                m.nombre AS medida 
            FROM 
                guiaRemisionDetalle AS gd
            INNER JOIN 
                producto AS p ON gd.idProducto = p.idProducto
            INNER JOIN 
                medida AS m ON m.idMedida = p.idMedida
            WHERE 
                gd.idGuiaRemision = ?`, [
                req.params.idGuiaRemision
            ]);

            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/api/v1/guiaremision/${tipo}`,
                headers: {
                    'Content-Type': 'application/json'
                },
                data: {
                    "guiaRemision": guiaRemision[0],
                    "empresa": newEmpresa,
                    "sucursal": sucursal[0],
                    "guiaRemisionDetalle": detalles,
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            sendPdf(res, response.data);
        } catch (error) {
            registerLog('Reporte/generarFacturacion:', error);
            sendError(res, "Error al obtener el PDF")
        }
    }

    async generarCompra(req, res, tipo) {

    }

    async reportePdfVenta(req, res) {
        try {
            const fechaInicio = req.params.fechaInicio;
            const fechaFinal = req.params.fechaFinal;
            const idComprobante = req.params.idComprobante === "-" ? "" : req.params.idComprobante;
            const idSucursal = req.params.idSucursal === "-" ? "" : req.params.idSucursal;
            const idUsuario = req.params.idUsuario === "-" ? "" : req.params.idUsuario;

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

            const newEmpresa = {
                ...empresa[0],
                "logoEmpresa": `${process.env.APP_URL}/files/company/${empresa[0].rutaLogo}`,
                "logoDesarrollador": `${process.env.APP_URL}/files/to/logo.png`,
            }

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
                req.params.idSucursalGenerado
            ]);

            const ventas = await conec.procedure(`CALL Obtener_Venta_Reporte(?,?,?,?,?)`, [
                fechaInicio,
                fechaFinal,
                idComprobante,
                idSucursal,
                idUsuario,
            ])

            let comprobante = null;

            if (idComprobante !== "") {
                comprobante = await conec.query(`
                SELECT 
                    nombre
                FROM 
                    comprobante
                WHERE
                    idComprobante = ?`, [
                    idComprobante
                ])
            }

            let sucursalFiltro = null;

            if (idSucursal !== "") {
                sucursalFiltro = await conec.query(`
                SELECT 
                    nombre
                FROM 
                    sucursal
                WHERE
                    idSucursal = ?`, [
                    idSucursal
                ]);
            }

            let usuario = null;

            if (idUsuario !== "") {
                usuario = await conec.query(`
                SELECT 
                    p.descripcion AS rol,
                    u.apellidos,
                    u.nombres
                FROM 
                    usuario AS u
                INNER JOIN 
                    perfil AS p ON u.idPerfil = p.idPerfil
                WHERE 
                    u.idUsuario = ?`, [
                    idUsuario
                ]);
            }

            const cabecera = {
                "fechaInicio": fechaInicio,
                "fechaFinal": fechaFinal,
                "comprobante": idComprobante === "" ? "TODOS" : comprobante[0].nombre,
                "sucursal": idSucursal === "" ? "TODOS" : sucursalFiltro[0].nombre,
                "rol": idUsuario === "" ? "-" : usuario[0].rol,
                "usuario": idUsuario == "" ? "TODOS" : usuario[0].apellidos + ", " + usuario[0].nombres
            }

            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/api/v1/cotizacion/reporte/a4`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    "cabecera": cabecera,
                    "empresa": newEmpresa,
                    "sucursal": sucursal[0],
                    "detalles": ventas
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            sendPdf(res, response.data);
        } catch (error) {
            registerLog('Reporte/reportPdfVenta:', error);
            sendError(res, "Error al obtener el PDF")
        }
    }

    async reporteExcelVenta(req, res) {
        try {
            const fechaInicio = req.params.fechaInicio;
            const fechaFinal = req.params.fechaFinal;
            const idComprobante = req.params.idComprobante === "-" ? "" : req.params.idComprobante;
            const idSucursal = req.params.idSucursal === "-" ? "" : req.params.idSucursal;
            const idUsuario = req.params.idUsuario === "-" ? "" : req.params.idUsuario;

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
                req.params.idSucursalGenerado
            ]);

            const ventas = await conec.procedure(`CALL Obtener_Venta_Reporte(?,?,?,?,?)`, [
                fechaInicio,
                fechaFinal,
                idComprobante,
                idSucursal,
                idUsuario,
            ])

            let comprobante = null;

            if (idComprobante !== "") {
                comprobante = await conec.query(`
                SELECT 
                    nombre
                FROM 
                    comprobante
                WHERE
                    idComprobante = ?`, [
                    idComprobante
                ])
            }

            let sucursalFiltro = null;

            if (idSucursal !== "") {
                sucursalFiltro = await conec.query(`
                SELECT 
                    nombre
                FROM 
                    sucursal
                WHERE
                    idSucursal = ?`, [
                    idSucursal
                ]);
            }

            let usuario = null;

            if (idUsuario !== "") {
                usuario = await conec.query(`
                SELECT 
                    p.descripcion AS rol,
                    u.apellidos,
                    u.nombres
                FROM 
                    usuario AS u
                INNER JOIN 
                    perfil AS p ON u.idPerfil = p.idPerfil
                WHERE 
                    u.idUsuario = ?`, [
                    idUsuario
                ]);
            }

            const cabecera = {
                "fechaInicio": fechaInicio,
                "fechaFinal": fechaFinal,
                "comprobante": idComprobante === "" ? "TODOS" : comprobante[0].nombre,
                "sucursal": idSucursal === "" ? "TODOS" : sucursalFiltro[0].nombre,
                "rol": idUsuario === "" ? "-" : usuario[0].rol,
                "usuario": idUsuario == "" ? "TODOS" : usuario[0].apellidos + ", " + usuario[0].nombres
            }

            const wb = new xl.Workbook();

            let ws = wb.addWorksheet('Hoja 1');

            const styleTitle = wb.createStyle({
                alignment: {
                    horizontal: 'center'
                },
                font: {
                    color: '#000000',
                    size: 12,
                },
            });

            const styleHeader = wb.createStyle({
                alignment: {
                    horizontal: 'left'
                },
                font: {
                    color: '#000000',
                    size: 12,
                }
            });

            const styleTableHeader = wb.createStyle({
                alignment: {
                    horizontal: 'center'
                },
                font: {
                    bold: true,
                    color: '#000000',
                    size: 12,
                },

            });

            const styleBody = wb.createStyle({
                alignment: {
                    horizontal: 'left'
                },
                font: {
                    color: '#000000',
                    size: 12,
                }
            });

            const styleBodyInteger = wb.createStyle({
                alignment: {
                    horizontal: 'left'
                },
                font: {
                    color: '#000000',
                    size: 12,
                }
            });

            const styleBodyFloat = wb.createStyle({
                alignment: {
                    horizontal: 'left'
                },
                font: {
                    color: '#000000',
                    size: 12,
                },
                numberFormat: '#,##0.00; (#,##0.00); 0',
            });

            ws.column(1).setWidth(10);
            ws.column(2).setWidth(20);
            ws.column(3).setWidth(20);
            ws.column(4).setWidth(20);
            ws.column(5).setWidth(15);
            ws.column(6).setWidth(15);
            ws.column(7).setWidth(15);
            ws.column(8).setWidth(20);
            ws.column(9).setWidth(15);
            ws.column(10).setWidth(15);

            // Cabecera
            ws.cell(1, 1, 1, 11, true).string(`${empresa[0].razonSocial}`).style(styleTitle);
            ws.cell(2, 1, 2, 11, true).string(`RUC: ${empresa[0].razonSocial}`).style(styleTitle);
            ws.cell(3, 1, 3, 11, true).string(`${sucursal[0].direccion}`).style(styleTitle);
            ws.cell(4, 1, 4, 11, true).string(`Celular: ${sucursal[0].celular} / Telefono: ${sucursal[0].telefono}`).style(styleTitle);

            // Filtros           
            ws.cell(6, 1, 6, 11, true).string(`REPORTE DE VENTAS`).style(styleTitle);
            ws.cell(7, 1, 7, 11, true).string(`PERIODO: ${dateFormat(fechaInicio)} al ${dateFormat(fechaFinal)}`).style(styleTitle);

            ws.cell(9, 1).string(`Comprobante(s):`).style(styleHeader);
            ws.cell(9, 2).string(`${cabecera.comprobante}`).style(styleHeader);

            ws.cell(10, 1).string(`Vendedor(s):`).style(styleHeader);
            ws.cell(10, 2).string(`${cabecera.usuario}`).style(styleHeader);

            ws.cell(11, 1).string(`Sucursal(s):`).style(styleHeader);
            ws.cell(11, 2).string(`${cabecera.sucursal}`).style(styleHeader);

            // Detalle
            const header = ["N°", "N° DOCUMENTO", "CLIENTE", "COMPROBANTE", "SERIE", "NUMERACION", "FECHA", "FORMA DE PAGO", "ESTADO", "MONTO"];

            header.map((item, index) => ws.cell(13, 1 + index).string(item).style(styleTableHeader));

            ventas.map((item, index) => {
                let formaPago = "";
                if (item.idFormaPago === "FP0001") {
                    formaPago = "CONTADO";
                } else {
                    formaPago = "CRÉDITO";
                }

                let estado = "";
                if (item.estado === 1) {
                    estado = "COBRADO";
                } else if (item.estado === 2) {
                    estado = "POR COBRAR";
                } else if (item.estado === 3) {
                    estado = "ANULADO";
                } else {
                    estado = "POR LLEVAR";
                }

                ws.cell(14 + index, 1).number(parseInt(index + 1)).style(styleBodyInteger)
                ws.cell(14 + index, 2).string(item.documento).style(styleBody)
                ws.cell(14 + index, 3).string(item.cliente).style(styleBody)
                ws.cell(14 + index, 4).string(item.comprobante).style(styleBody)
                ws.cell(14 + index, 5).string(item.serie).style(styleBody)
                ws.cell(14 + index, 6).number(item.numeracion).style(styleBodyInteger)
                ws.cell(14 + index, 7).string(dateFormat(item.fecha)).style(styleBody)
                ws.cell(14 + index, 8).string(formaPago).style(styleBody)
                ws.cell(14 + index, 9).string(estado).style(styleBody)
                ws.cell(14 + index, 10).number(parseFloat(item.monto)).style(styleBodyFloat)
            });

            const data = await wb.writeToBuffer()

            sendSuccess(res, {
                buffer: data
            });
        } catch (error) {
            registerLog('Reporte/reportExcelVenta:', error);
            sendError(res, "Error al obtener el PDF")
        }
    }

    async reportePdfFinanciero(req, res) {
        try {
            const fechaInicio = req.params.fechaInicio;
            const fechaFinal = req.params.fechaFinal;
            const idSucursal = req.params.idSucursal === "-" ? "" : req.params.idSucursal;
            const idUsuario = req.params.idUsuario === "-" ? "" : req.params.idUsuario;

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

            const newEmpresa = {
                ...empresa[0],
                "logoEmpresa": `${process.env.APP_URL}/files/company/${empresa[0].rutaLogo}`,
                "logoDesarrollador": `${process.env.APP_URL}/files/to/logo.png`,
            }

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
                req.params.idSucursalGenerado
            ]);

            const conceptos = await conec.procedure(`CALL Obtener_Financiero_Reporte(?,?,?,?)`, [
                fechaInicio,
                fechaFinal,
                idSucursal,
                idUsuario
            ])

            const bancos = await conec.procedure(`CALL Obtener_Resumen_Banco(?,?,?,?)`, [
                fechaInicio,
                fechaFinal,
                idSucursal,
                idUsuario
            ]);

            let sucursalFiltro = null;

            if (idSucursal !== "") {
                sucursalFiltro = await conec.query(`
                SELECT 
                    nombre
                FROM 
                    sucursal
                WHERE
                    idSucursal = ?`, [
                    idSucursal
                ]);
            }

            let usuario = null;

            if (idUsuario !== "") {
                usuario = await conec.query(`
                SELECT 
                    p.descripcion AS rol,
                    u.apellidos,
                    u.nombres
                FROM 
                    usuario AS u
                INNER JOIN 
                    perfil AS p ON u.idPerfil = p.idPerfil
                WHERE 
                    u.idUsuario = ?`, [
                    idUsuario
                ]);
            }

            const cabecera = {
                "fechaInicio": fechaInicio,
                "fechaFinal": fechaFinal,
                "sucursal": idSucursal === "" ? "TODOS" : sucursalFiltro[0].nombre,
                "rol": idUsuario === "" ? "-" : usuario[0].rol,
                "usuario": idUsuario == "" ? "TODOS" : usuario[0].apellidos + ", " + usuario[0].nombres
            }

            const options = {
                method: 'POST',
                url: `${process.env.APP_PDF}/api/v1/finanzas/a4`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    "cabecera": cabecera,
                    "empresa": newEmpresa,
                    "sucursal": sucursal[0],
                    "conceptos": conceptos,
                    "bancos": bancos
                },
                responseType: 'arraybuffer'
            };

            const response = await axios.request(options);
            sendPdf(res, response.data);
        } catch (error) {
            registerLog('Reporte/reportePdfFinanciero:', error);
            sendError(res, "Error al obtener el PDF")
        }
    }

    async reporteExcelFinanciero(req, res) {
        try {
            console.log(req.params)

            const wb = new xl.Workbook();

            let ws = wb.addWorksheet('Hoja 1');

            const styleTitle = wb.createStyle({
                alignment: {
                    horizontal: 'center'
                },
                font: {
                    color: '#000000',
                    size: 12,
                },
            });

            const styleNameSucursal = wb.createStyle({
                alignment: {
                    horizontal: 'left'
                },
                font: {
                    color: '#000000',
                    size: 12,
                },
            });

            const styleHeader = wb.createStyle({
                alignment: {
                    horizontal: 'left'
                },
                font: {
                    color: '#000000',
                    size: 12,
                }
            });

            const styleTableHeader = wb.createStyle({
                alignment: {
                    horizontal: 'center'
                },
                font: {
                    bold: true,
                    color: '#000000',
                    size: 12,
                },

            });

            const styleBody = wb.createStyle({
                alignment: {
                    horizontal: 'left'
                },
                font: {
                    color: '#000000',
                    size: 12,
                }
            });

            const styleBodyInteger = wb.createStyle({
                alignment: {
                    horizontal: 'left'
                },
                font: {
                    color: '#000000',
                    size: 12,
                }
            });

            const styleBodyFloat = wb.createStyle({
                alignment: {
                    horizontal: 'left'
                },
                font: {
                    color: '#000000',
                    size: 12,
                },
                numberFormat: '#,##0.00; (#,##0.00); 0',
            });

            ws.column(1).setWidth(5);
            ws.column(2).setWidth(20);
            ws.column(3).setWidth(15);
            ws.column(4).setWidth(15);
            ws.column(5).setWidth(35);
            ws.column(6).setWidth(25);
            ws.column(7).setWidth(15);
            ws.column(8).setWidth(20);
            ws.column(9).setWidth(15);
            ws.column(10).setWidth(15);
            ws.column(11).setWidth(15);

            const data = await wb.writeToBuffer()

            sendSuccess(res, {
                buffer: data
            });
        } catch (error) {
            registerLog('Reporte/reporteExcelFinanciero:', error);
            sendError(res, "Error al obtener el PDF")
        }
    }

    async reporteExcelCEPSunat(req, res) {
        try {
            const fechaInicio = req.params.fechaInicio;
            const fechaFinal = req.params.fechaFinal;
            const idSucursal = req.params.idSucursal === "-" ? "" : req.params.idSucursal;

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
                req.params.idSucursalGenerado
            ]);

            let sucursalFiltro = null;

            if (idSucursal !== "") {
                sucursalFiltro = await conec.query(`
                SELECT 
                    nombre
                FROM 
                    sucursal
                WHERE
                    idSucursal = ?`, [
                    idSucursal
                ]);
            }

            const comprobantes = await conec.procedure(`CALL Obtener_CpeSunat_Reporte(?,?,?)`, [
                fechaInicio,
                fechaFinal,
                idSucursal
            ]);

            const cabecera = {
                "fechaInicio": fechaInicio,
                "fechaFinal": fechaFinal,
                "sucursal": idSucursal === "" ? "TODOS" : sucursalFiltro[0].nombre,
            }

            const wb = new xl.Workbook();

            let ws = wb.addWorksheet('Hoja 1');

            const styleTitle = wb.createStyle({
                alignment: {
                    horizontal: 'center'
                },
                font: {
                    color: '#000000',
                    size: 12,
                },
            });

            const styleHeader = wb.createStyle({
                alignment: {
                    horizontal: 'left'
                },
                font: {
                    color: '#000000',
                    size: 12,
                }
            });

            const styleTableHeader = wb.createStyle({
                alignment: {
                    horizontal: 'center'
                },
                font: {
                    bold: true,
                    color: '#000000',
                    size: 12,
                },

            });

            const styleBody = wb.createStyle({
                alignment: {
                    horizontal: 'left'
                },
                font: {
                    color: '#000000',
                    size: 12,
                }
            });

            const styleBodyInteger = wb.createStyle({
                alignment: {
                    horizontal: 'left'
                },
                font: {
                    color: '#000000',
                    size: 12,
                }
            });

            const styleBodyFloat = wb.createStyle({
                alignment: {
                    horizontal: 'left'
                },
                font: {
                    color: '#000000',
                    size: 12,
                },
                numberFormat: '#,##0.00; (#,##0.00); 0',
            });

            ws.column(1).setWidth(10);
            ws.column(2).setWidth(20);
            ws.column(3).setWidth(20);
            ws.column(4).setWidth(20);
            ws.column(5).setWidth(15);
            ws.column(6).setWidth(20);
            ws.column(7).setWidth(15);
            ws.column(8).setWidth(20);
            ws.column(9).setWidth(15);
            ws.column(10).setWidth(15);
            ws.column(11).setWidth(15);
            ws.column(12).setWidth(15);
            ws.column(13).setWidth(15);
            ws.column(14).setWidth(15);
            ws.column(15).setWidth(25);

            // Cabecera
            ws.cell(1, 1, 1, 11, true).string(`${empresa[0].razonSocial}`).style(styleTitle);
            ws.cell(2, 1, 2, 11, true).string(`RUC: ${empresa[0].razonSocial}`).style(styleTitle);
            ws.cell(3, 1, 3, 11, true).string(`${sucursal[0].direccion}`).style(styleTitle);
            ws.cell(4, 1, 4, 11, true).string(`Celular: ${sucursal[0].celular} / Telefono: ${sucursal[0].telefono}`).style(styleTitle);

            // Filtros           
            ws.cell(6, 1, 6, 11, true).string(`REPORTE DE COMPROBANTES EMITIDOS A SUNAT`).style(styleTitle);
            ws.cell(7, 1, 7, 11, true).string(`PERIODO: ${dateFormat(fechaInicio)} al ${dateFormat(fechaFinal)}`).style(styleTitle);

            ws.cell(9, 1).string(`Sucursal(s):`).style(styleHeader);
            ws.cell(9, 2).string(`${cabecera.sucursal}`).style(styleHeader);

            // Detalle
            const header = ["N°", "FECHA", "TIPO DOCUMENTO", "N° DOCUMENTO", "RUC/DNI", "COMPROBANTE", "SERIE", "NUMERACIÓN", "MONEDA", "SUB TOTAL", "IGV", "EXONERADO", "TOTAL", "ANULADO", "DESCRIPCIÓN"];

            header.map((item, index) => ws.cell(11, 1 + index).string(item).style(styleTableHeader));

            comprobantes.map((item, index) => {
                ws.cell(12 + index, 1).number(parseInt(index + 1)).style(styleBodyInteger);
                ws.cell(12 + index, 2).string(item.fecha).style(styleBody)
                ws.cell(12 + index, 3).string(item.tipoDocumento).style(styleBody)
                ws.cell(12 + index, 4).string(item.documento).style(styleBody)
                ws.cell(12 + index, 5).string(item.informacion).style(styleBody)

                ws.cell(12 + index, 6).string(item.comprobante).style(styleBody)
                ws.cell(12 + index, 7).string(item.serie).style(styleBody)
                ws.cell(12 + index, 8).number(item.numeracion).style(styleBodyInteger)

                ws.cell(12 + index, 9).string(item.codiso).style(styleBody)
                ws.cell(12 + index, 10).number(parseFloat(item.numeracion)).style(styleBodyFloat)
                ws.cell(12 + index, 11).number(parseFloat(item.numeracion)).style(styleBodyFloat)
                ws.cell(12 + index, 12).number(parseFloat(item.numeracion)).style(styleBodyFloat)

                if (item.xmlSunat === '0') {
                    ws.cell(12 + index, 13).number(parseFloat(item.total)).style(styleBodyFloat)
                    ws.cell(12 + index, 14).number(parseFloat(0)).style(styleBodyFloat)
                } else {
                    ws.cell(12 + index, 13).number(parseFloat(0)).style(styleBodyFloat)
                    ws.cell(12 + index, 14).number(parseFloat(item.total)).style(styleBodyFloat)
                }

                ws.cell(12 + index, 15).string(item.xmlDescripcion).style(styleBody)
            });

            const data = await wb.writeToBuffer();

            sendSuccess(res, {
                buffer: data
            });
        } catch (error) {
            registerLog('Reporte/reporteExcelCEPSunat:', error);
            sendError(res, "Error al obtener el PDF")
        }
    }

    async generarXmlSunat(req, res) {
        try {
            const empresa = await conec.query(`
            SELECT 
                documento,
                razonSocial,
                nombreEmpresa
            FROM 
                empresa
            LIMIT 
                1`);

            const xml = await conec.query(`
            SELECT 
                v.xmlGenerado,
                co.nombre,
                v.serie,
                v.numeracion
            FROM 
                venta AS v 
            INNER JOIN 
                comprobante AS co ON v.idComprobante = co.idComprobante
            WHERE 
                v.idVenta = ?
    
            UNION
            
            SELECT 
                gu.xmlGenerado,
                co.nombre,
                gu.serie,
                gu.numeracion
            FROM 
                guiaRemision AS gu 
            INNER JOIN 
                comprobante AS co ON gu.idComprobante = co.idComprobante
            WHERE 
                gu.idGuiaRemision = ?`, [
                req.params.idComprobante,
                req.params.idComprobante,
            ]);

            console.log(xml)

            if (xml.length === 0) {
                return sendClient(res, "No hay información del comprobante.");
            }

            if (xml[0].xmlGenerado === null || xml[0].xmlGenerado === "") {
                return sendClient(res, "El comprobante no tiene generado ningún xml.");
            }

            const xmlBuffer = Buffer.from(xml[0].xmlGenerado, 'utf-8');

            const object = {
                "name": `${empresa[0].razonSocial} ${xml[0].nombre} ${xml[0].serie}-${xml[0].numeracion}.xml`,
                "buffer": xmlBuffer
            };
            // const buffXmlSunat = Buffer.from(JSON.stringify(object), "utf-8");
            // res.end(buffXmlSunat);
            sendSuccess(res, object);
        } catch (error) {
            sendError(res, "Error al obtener el PDF")
        }
    }

}

module.exports = Reporte;