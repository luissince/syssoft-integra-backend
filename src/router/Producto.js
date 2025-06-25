const express = require('express');
const router = express.Router();
const Producto = require('../services/Producto');

const producto = new Producto();

router.get('/list', async (req, res) => await producto.list(req, res));

router.post('/', async (req, res) => await producto.create(req, res));

router.get('/id/:idProducto', async (req, res) => await producto.id(req, res));

router.put('/', async (req, res) => await producto.update(req, res));

router.delete('/:idProducto', async (req, res) => await producto.delete(req, res));

router.get('/detalle', async (req, res) => await producto.detalle(req, res));

router.get('/combo', async (req, res) => await producto.combo(req, res));

router.get('/filtrar/venta', async (req, res) => await producto.filtrarParaVenta(req, res));

router.get('/filter', async (req, res) => await producto.filter(req, res));

router.get('/filter/almacen', async (req, res) => await producto.filterAlmacen(req, res));

router.get('/preferidos', async (req, res) => await producto.preferidos(req, res));

router.put('/establecer/preferido', async (req, res) => await producto.preferidoEstablecer(req, res));

router.get('/lista/precios', async (req, res) => await producto.obtenerListPrecio(req, res));

router.get('/filter/web/rangeprice', async (req, res) => await producto.rangePriceWeb(req, res));

router.post('/filter/web', async (req, res) => await producto.filterWeb(req, res));

router.get('/filter/web/limit/:limit', async (req, res) => await producto.filterWebLimit(req, res));

router.get('/filter/web/id', async (req, res) => await producto.filterWebId(req, res));

router.get('/filter/web/related/id', async (req, res) => await producto.filterWebRelatedId(req, res));

router.get("/documents/pdf/reports", async (req, res) => await producto.documentsPdfReports(req, res));

router.get("/documents/excel", async (req, res) => await producto.documentsPdfExcel(req, res));

router.get("/documents/pdf/codbar", async (req, res) => await producto.documentsPdfCodBar(req, res));

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