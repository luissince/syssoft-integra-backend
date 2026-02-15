const express = require('express');
const router = express.Router();
const producto = require('../controllers/producto.controller');

router.get('/list', producto.list);

router.post('/', producto.create);

router.get('/id/:idProducto', producto.id);

router.put('/', producto.update);

router.delete('/', producto.remove);

router.get('/detalle', producto.detalle);

router.get('/combo', producto.combo);

router.get('/filtrar/venta', producto.filtrarParaVenta);

router.get('/filter', producto.filter);

router.get('/filter/almacen', producto.filterAlmacen);

router.put('/establecer/preferido', producto.preferidoEstablecer);

router.get('/lista/precios', producto.obtenerListPrecio);

router.get('/filter/web/rangeprice', producto.rangePriceWeb);

router.post('/filter/web', producto.filterWeb);

router.get('/filter/web/limit/:limit', producto.filterWebLimit);

router.get('/filter/web/all', producto.filterWebAll);

router.get('/filter/web/id', producto.filterWebId);

router.get('/filter/web/related/id', producto.filterWebRelatedId);

router.get("/documents/pdf/reports", producto.documentsPdfReports);

router.get("/documents/excel", producto.documentsPdfExcel);

router.get("/documents/pdf/codbar", producto.documentsPdfCodBar);

router.post("/dashboard", producto.dashboard);

router.get("/update-inventario", producto.updateInventario);

// router.get('/filtrar/venta', async function (req, res) {
// return responseSSE(req, res, async (sendEvent) => {
//     const result = await producto.filtrarParaVenta(req)
//     if (typeof result === 'object') {
//         for await (const list of result.lists) {
//             sendEvent(list);
//             await new Promise(resolve => setTimeout(resolve, 100));
//         }
//         sendEvent(result.total);
//     }

//     sendEvent('__END__')
// });
// });

module.exports = router;