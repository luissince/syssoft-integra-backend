const express = require('express');
const app = express();
const router = express.Router();
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const { currentDate, currentTime } = require('./src/tools/Tools');
const pkg = require('./package.json');

require('dotenv').config();

// Middleware para el registro de solicitudes (morgan)
app.use(morgan('dev'));

// Middleware para permitir solicitudes CORS
app.use(cors({
    exposedHeaders: ['Content-Disposition'] // Importante para que el cliente pueda leer este header
}));

// Middleware para servir archivos estáticos desde diferentes carpetas
router.use('/company', express.static(path.join(__dirname, 'src', 'path', 'company')));
router.use('/proyect', express.static(path.join(__dirname, 'src', 'path', 'proyect')));
router.use('/to', express.static(path.join(__dirname, 'src', 'path', 'to')));

// Montar el router en la ruta 'imagenes, archivos entre otros'
app.use('/files', router);

// Configuración del puerto
app.set('port', process.env.PORT || 5000);

// Configuración de middleware para manejar JSON y datos codificados en URL
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: false }));

// Cargar la app estatica compilada
// app.use(express.static(path.join(__dirname, "app", "dist")));

// Middleware para validar rutas
// app.use((req, res, next) => {
//     console.log('===================== Middleware validar ruta ===================');
//     const decoded = verifyToken(req, process.env.TOKEN_ACCESSO);
//     if(!decoded){
//         return sendNoAutorizado(res, { message: 'Acceso no autorizado' });
//     }
//     console.log('Decoded:', decoded);
//     next();
// });

// Middleware para registrar las solicitudes
app.use((req, res, next) => {
    console.log(`[${currentDate()} ${currentTime()}]`);
    console.log('Solicitud recibida:');
    console.log('Método:', req.method);
    console.log('URL:', req.url);
    console.log('Cabecera(req.headers):', req.headers);
    console.log('Cuerpo(req.body):', req.body);
    console.log('Parametro(req.params):', req.params);
    console.log('Consulta(req.query):', req.query);
    next();
});

// Ruta principal
app.get('/', (_, res) => {
    res.json({
        "Bienvenidos": `API SYSSOFT INTEGRA V.${pkg.version}`, 
        "Fecha y hora actuales": new Date().toLocaleDateString(),
        "Entorno": process.env.ENVIRONMENT
    });
});

// Rutas API
app.use('/api/comprobante', require('./src/router/Comprobante'));
app.use('/api/moneda', require('./src/router/Moneda'));
app.use('/api/banco', require('./src/router/Banco'));
app.use('/api/transaccion', require('./src/router/Transaccion'));
app.use('/api/impuesto', require('./src/router/Impuesto'));

app.use('/api/sucursal', require('./src/router/Sucursal'));
app.use('/api/categoria', require('./src/router/Categoria'));
app.use('/api/marca', require('./src/router/Marca'));
app.use('/api/atributo', require('./src/router/Atributo'));
app.use('/api/producto', require('./src/router/Producto'));
app.use('/api/almacen', require('./src/router/Almacen'));

app.use('/api/persona', require('./src/router/Persona'));
app.use('/api/factura', require('./src/router/Factura'));

app.use('/api/perfil', require('./src/router/perfil.router'));
app.use('/api/usuario', require('./src/router/usuario.router'));

app.use('/api/concepto', require('./src/router/Concepto'));
app.use('/api/gasto', require('./src/router/Gasto'));
app.use('/api/cobro', require('./src/router/Cobro'));
app.use('/api/acceso', require('./src/router/acceso.router'));
app.use('/api/notacredito', require('./src/router/NotaCredito'));

app.use('/api/ubigeo', require('./src/router/Ubigeo'));
app.use('/api/tipodocumento', require('./src/router/TipoDocumento'));
app.use('/api/medida', require('./src/router/Medida'));
app.use('/api/motivo', require('./src/router/Motivo'));

app.use('/api/empresa', require('./src/router/Empresa'));
app.use('/api/dashboard', require('./src/router/dashboard.router'));
app.use('/api/notificacion', require('./src/router/Notificacion'));

app.use('/api/kardex', require('./src/router/Kardex'));
app.use('/api/metodopago', require('./src/router/MetodoPago'));
app.use('/api/tipoajuste', require('./src/router/TipoAjuste'));
app.use('/api/tipoatributo', require('./src/router/TipoAtributo'));
app.use('/api/inventario', require('./src/router/Inventario'));
app.use('/api/ajuste', require('./src/router/Ajuste'));
app.use('/api/motivoajuste', require('./src/router/MotivoAjuste'));
app.use('/api/compra', require('./src/router/Compra'));
app.use('/api/guiaremision', require('./src/router/GuiaRemision'));
app.use('/api/cotizacion', require('./src/router/Cotizacion'));
app.use('/api/tipocomprobante', require('./src/router/TipoComprobante'));
app.use('/api/traslado', require('./src/router/Traslado'));
app.use('/api/motivotraslado', require('./src/router/MotivoTraslado'));
app.use('/api/tipotraslado', require('./src/router/TipoTraslado'));
app.use('/api/modalidadtraslado', require('./src/router/ModalidadTraslado'));
app.use('/api/tipopeso', require('./src/router/TipoPeso'));
app.use('/api/tipoalmacen', require('./src/router/TipoAlmacen'));
app.use('/api/vehiculo', require('./src/router/Vehiculo'));
app.use('/api/ordencompra', require('./src/router/OrdenCompra'));
app.use('/api/pedido', require('./src/router/Pedido'));
app.use('/api/catalogo', require('./src/router/catalogo.router'));

app.use('/api/reporte', require('./src/router/Reporte'));
app.use('/api/sunat', require('./src/router/Sunat'));
app.use('/api/consulta', require('./src/router/Consulta'));

// app.use((req, res, next) => {
//     res.sendFile(path.join(__dirname, "app", "dist", "index.html"));
// });

// Iniciar el servidor
app.listen(app.get("port"), () => {
    console.log(`El servidor está corriendo en el puerto ${app.get("port")}`);
});
