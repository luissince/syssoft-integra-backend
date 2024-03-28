const express = require('express');
const app = express();
const router = express.Router();  // Crear un router para organizar rutas
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swagger = require('./src/swagger');
const { isFile } = require('./src/tools/Tools');

require('dotenv').config();

// Middleware para el registro de solicitudes (morgan)
app.use(morgan('dev'));

// Middleware para permitir solicitudes CORS
app.use(cors());

// Middleware para servir archivos estáticos desde diferentes carpetas
router.use('/company', express.static(path.join(__dirname, 'src', 'path', 'company')));
router.use('/proyect', express.static(path.join(__dirname, 'src', 'path', 'proyect')));
router.use('/product', express.static(path.join(__dirname, 'src', 'path', 'product')));
router.use('/to', express.static(path.join(__dirname, 'src', 'path', 'to')));

// Montar el router en la ruta 'imagenes, archivos entre otros'
app.use('/files', router);

// Configuración del puerto
app.set('port', process.env.PORT || 5000);

// Configuración de middleware para manejar JSON y datos codificados en URL
app.use(express.json({ limit: '1024mb' }));
app.use(express.urlencoded({ extended: false }));

// Middleware para servir la documentación de Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swagger));

// Ruta principal
app.get('/', (_, res) => {
    res.json({
        "Bienvenidos": "API SYSSOFT INTEGRA V.1.0.0",
        "Fecha y hora actuales": new Date().toLocaleDateString(),
        "Entorno": process.env.ENVIRONMENT
    });
});

// Ruta para obtener las imagene por nombre
app.get('/imagen/:nombreImagen', (req, res) => {
    const nombreImagen = req.params.nombreImagen;

    if (!nombreImagen) {
        return res.status(404).json({ error: 'El parámetro de nombre de imagen está incompleto.' });
    }

    const noImange =  path.join(__dirname, 'src', 'path', 'to', 'noimage.jpg');

    const rutas = [
        path.join(__dirname, 'src', 'path', 'to', nombreImagen),
        path.join(__dirname, 'src', 'path', 'company', nombreImagen),
        path.join(__dirname, 'src', 'path', 'proyect', nombreImagen),
        path.join(__dirname, 'src', 'path', 'product', nombreImagen)
    ];

    let imagenEncontrada = false;

    for (const ruta of rutas) {
        if (fs.existsSync(ruta)) {
            res.sendFile(ruta);
            imagenEncontrada = true;
            break;
        }
    }

    if (!imagenEncontrada) {
        res.sendFile(noImange)
    }
});

// Rutas API
app.use('/api/comprobante', require('./src/router/Comprobante'));
app.use('/api/moneda', require('./src/router/Moneda'));
app.use('/api/banco', require('./src/router/Banco'));
app.use('/api/impuesto', require('./src/router/Impuesto'));

app.use('/api/sucursal', require('./src/router/Sucursal'));
app.use('/api/categoria', require('./src/router/Categoria'));
app.use('/api/producto', require('./src/router/Producto'));
app.use('/api/almacen', require('./src/router/Almacen'));

app.use('/api/persona', require('./src/router/Persona'));
app.use('/api/factura', require('./src/router/Factura'));
app.use('/api/login', require('./src/router/Login'));

app.use('/api/perfil', require('./src/router/Perfil'));
app.use('/api/usuario', require('./src/router/Usuario'));

app.use('/api/concepto', require('./src/router/Concepto'));
app.use('/api/gasto', require('./src/router/Gasto'));
app.use('/api/cobro', require('./src/router/Cobro'));
app.use('/api/acceso', require('./src/router/Acceso'));
app.use('/api/notacredito', require('./src/router/NotaCredito'));

app.use('/api/ubigeo', require('./src/router/Ubigeo'));
app.use('/api/tipodocumento', require('./src/router/TipoDocumento'));
app.use('/api/medida', require('./src/router/Medida'));
app.use('/api/motivo', require('./src/router/Motivo'));

app.use('/api/empresa', require('./src/router/Empresa'));
app.use('/api/dashboard', require('./src/router/Dashboard'));
app.use('/api/notificacion', require('./src/router/Notificacion'));

app.use('/api/kardex', require('./src/router/Kardex'));
app.use('/api/metodopago', require('./src/router/MetodoPago'));
app.use('/api/tipoajuste', require('./src/router/TipoAjuste'));
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
app.use('/api/vehiculo', require('./src/router/Vehiculo'));

app.use('/api/salida', require('./src/router/Salida'));
app.use('/api/ingreso', require('./src/router/Ingreso'));

app.use('/api/reporte', require('./src/router/Reporte'));
app.use('/api/sunat', require('./src/router/Sunat'));

// Iniciar el servidor
app.listen(app.get("port"), () => {
    console.log(`El servidor está corriendo en el puerto ${app.get("port")}`);
});