const pkg = require('../../package.json');
const { currentDate, currentTime, formatDate, formatTime } = require('../tools/Tools');

module.exports = (app) => {
    // middleware index
    app.get('/', (_, res) => {
        res.json({
            "Bienvenidos": `API SYSSOFT INTEGRA V.${pkg.version}`,
            "Fecha y hora actuales": formatDate(currentDate()) + " " + formatTime(currentTime()),
            "Entorno": process.env.ENVIRONMENT
        });
    });

    // middlewares
    app.use('/api/comprobante', require('./Comprobante'));
    app.use('/api/moneda', require('./Moneda'));
    app.use('/api/banco', require('./Banco'));
    app.use('/api/transaccion', require('./Transaccion'));
    app.use('/api/impuesto', require('./Impuesto'));

    app.use('/api/sucursal', require('./Sucursal'));
    app.use('/api/categoria', require('./Categoria'));
    app.use('/api/marca', require('./Marca'));
    app.use('/api/atributo', require('./Atributo'));
    app.use('/api/producto', require('./Producto'));
    app.use('/api/almacen', require('./Almacen'));

    app.use('/api/persona', require('./Persona'));
    app.use('/api/factura', require('./Factura'));

    app.use('/api/perfil', require('./perfil.router'));
    app.use('/api/usuario', require('./usuario.route'));

    app.use('/api/concepto', require('./Concepto'));
    app.use('/api/gasto', require('./Gasto'));
    app.use('/api/cobro', require('./Cobro'));
    app.use('/api/acceso', require('./acceso.route'));
    app.use('/api/notacredito', require('./NotaCredito'));

    app.use('/api/ubigeo', require('./Ubigeo'));
    app.use('/api/tipodocumento', require('./TipoDocumento'));
    app.use('/api/medida', require('./Medida'));
    app.use('/api/motivo', require('./Motivo'));

    app.use('/api/empresa', require('./Empresa'));
    app.use('/api/dashboard', require('./dashboard.route'));
    app.use('/api/notificacion', require('./Notificacion'));

    app.use('/api/kardex', require('./Kardex'));
    app.use('/api/metodopago', require('./MetodoPago'));
    app.use('/api/tipoajuste', require('./TipoAjuste'));
    app.use('/api/tipoatributo', require('./TipoAtributo'));
    app.use('/api/inventario', require('./Inventario'));
    app.use('/api/ajuste', require('./Ajuste'));
    app.use('/api/motivoajuste', require('./MotivoAjuste'));
    app.use('/api/compra', require('./Compra'));
    app.use('/api/cotizacion', require('./Cotizacion'));
    app.use('/api/tipocomprobante', require('./TipoComprobante'));
    app.use('/api/motivotraslado', require('./MotivoTraslado'));
    app.use('/api/tipotraslado', require('./TipoTraslado'));
    app.use('/api/modalidadtraslado', require('./ModalidadTraslado'));
    app.use('/api/tipopeso', require('./TipoPeso'));
    app.use('/api/tipoalmacen', require('./TipoAlmacen'));
    app.use('/api/tipo/entrega', require('./TipoEntrega'));
    app.use('/api/vehiculo', require('./Vehiculo'));
    app.use('/api/ordencompra', require('./OrdenCompra'));
    app.use('/api/pedido', require('./Pedido'));
    app.use('/api/catalogo', require('./catalogo.route'));

    app.use('/api/reporte', require('./Reporte'));
    app.use('/api/sunat', require('./Sunat'));
    app.use('/api/consulta', require('./Consulta'));

    app.use('/api/guiaremision', require('./GuiaRemision'));
    app.use('/api/traslado', require('./traslado.route'));
};