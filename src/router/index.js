const express = require("express");
const router = express.Router();

/**
 * Lista de módulos simples
 * path = nombre endpoint
 * file = archivo router
 */
const modules = [
    ["comprobante", "./Comprobante"],
    ["moneda", "./Moneda"],
    ["banco", "./Banco"],
    ["transaccion", "./Transaccion"],
    ["impuesto", "./Impuesto"],

    ["sucursal", "./Sucursal"],
    ["categoria", "./Categoria"],
    ["marca", "./Marca"],

    ["persona", "./Persona"],
    ["factura", "./Factura"],

    ["concepto", "./Concepto"],
    ["gasto", "./Gasto"],
    ["cobro", "./Cobro"],

    ["ubigeo", "./Ubigeo"],
    ["tipodocumento", "./TipoDocumento"],
    ["medida", "./Medida"],
    ["motivo", "./Motivo"],

    ["empresa", "./Empresa"],
    ["notificacion", "./Notificacion"],

    ["metodopago", "./MetodoPago"],
    ["tipoajuste", "./TipoAjuste"],
    ["tipoatributo", "./TipoAtributo"],
    ["motivoajuste", "./MotivoAjuste"],

    ["compra", "./Compra"],
    ["guiaremision", "./GuiaRemision"],
    ["cotizacion", "./Cotizacion"],
    ["tipocomprobante", "./TipoComprobante"],

    ["motivotraslado", "./MotivoTraslado"],
    ["tipotraslado", "./TipoTraslado"],
    ["modalidadtraslado", "./ModalidadTraslado"],
    ["tipopeso", "./TipoPeso"],

    ["vehiculo", "./Vehiculo"],
    ["pedido", "./Pedido"],
    ["ordencompra", "./OrdenCompra"],

    ["sunat", "./Sunat"],
    ["consulta", "./Consulta"],

    // routers con nombre distinto
    ["catalogo", "./catalogo.routes"],
    ["producto", "./producto.routes"],
    ["kardex", "./kardex.routes"],
    ["perfil", "./perfil.routes"],
    ["acceso", "./acceso.routes"],

    ["inventario", "./inventario.routes"],

    ["ajuste", "./ajuste.routers"],
    ["traslado", "./traslado.routers"],

    ["reporte", "./reporte.routes"],
    ["plazo", "./plazo.routes"],
    ["ubicacion", "./ubicacion.routes"],

    ["usuario", "../modules/usuario/usuario.routes"],
    ["venta", "../modules/venta/venta.routes"],
    ["notacredito", "../modules/nota-credito/nota-credito.routes.js"],
    ["dashboard", "../modules/dashboard/dashboard.routes"],
    ["almacen", "../modules/almacen/almacen.routes"],
    ["tipoalmacen", "../modules/almacen/tipoAlmacen.routes"],
];

/**
 * Auto-montaje
 */
modules.forEach(([path, file]) => {
    router.use(`/${path}`, require(file));
});

module.exports = router;


// Uso a futuro
// const fs = require("fs");
// fs.readdirSync(__dirname).forEach(file => {
//     if (file.endsWith(".js")) {
//         const name = file.replace(".js", "").toLowerCase();
//         router.use(`/${name}`, require(`./${file}`));
//     }
// });
