const express = require('express');
const app = express();
const router = express.Router();
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const { currentDate, currentTime } = require('./src/tools/Tools');
const pkg = require('./package.json');
const { sendError, sendClient } = require('./src/tools/Message');
const { ClientError } = require('./src/tools/Error');

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
//     const decoded = verifyToken(req, process.env.TOKEN_ACCESS);
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
    console.log('Cuerpo(req.body):');
    console.dir(req.body, { depth: null });
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
app.use('/api', require("./src/router"));

// middleware 404
app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});

// middleware global de errores (SIEMPRE al final)
app.use((err, req, res, next) => {
    if (err instanceof ClientError) {
        return sendClient(res, {
            message: err.message || "Error de cliente",
            body: err.body ?? null
        });
    }

    return sendError(res, "Se produjo un error de servidor, intente nuevamente.", "Server", err);
});


// app.use((req, res, next) => {
//     res.sendFile(path.join(__dirname, "app", "dist", "index.html"));
// });


// Iniciar el servidor
app.listen(app.get("port"), () => {
    console.log(`El servidor está corriendo en el puerto ${app.get("port")}`);
});
