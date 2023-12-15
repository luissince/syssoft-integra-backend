// const http = require('http');
const express = require('express');
const app = express();
const path = require('path');
// const socket = require('socket.io');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swagger = require('./src/swagger');
/**
 * Carga de variable de entorno
 */
require('dotenv').config();

/**
 * Inicializando el constructor
 */

// const server = http.createServer(app);
// const io = socket(server, {
//     cors: { origin: "*" }
// });

// global.io = io;

// io.on('connection', (socket) => {
//     console.log('a user connected');

//     socket.on('message', (message) => {
//         console.log(message);
//         io.emit('message', `${socket.id.substr(0, 2)} said ${message}`);
//     });

//     socket.on("disconnect", () => {
//         console.log('desconnected ' + socket.id)
//     });
// });


/**
 * CORS para peticiones externas
 * setHeader('Access-Control-Allow-Origin', '*')
 * setHeader('Access-Control-Allow-Headers', 'X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Request-Method')
 * setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
 */
app.use(cors());

/**
 * 
 */
app.set('port', process.env.PORT || 5000);

app.use(express.json({ limit: '1024mb' }));
app.use(express.urlencoded({ limit: '1024mb', extended: false }));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swagger));

/**
 * Cargar la app estatica compilada
 */
// app.use(express.static(path.join(__dirname, "..", "app/build")));

/**
 * Mostar estaticanmente las imagenes del sucursal
 */
app.use(express.static(path.join(__dirname, "src/path/proyect")));

/**
 * Mostar estaticanmente las imagenes de la empresa
 */
app.use(express.static(path.join(__dirname, "src/path/company")));

/**
 * Cargar las rutas de la apis
 */
// app.use((req, res, next) => {
//     res.json({
//         "Bienvenidos": "API SYSSOFT INTEGRA V.1.0.0",
//         "Entorno": process.env.ENVIRONMENT
//     });
// });

app.get('/', (req, res) => {
    res.json({
        "Bienvenidos": "API SYSSOFT INTEGRA V.1.0.0",
        "Entorno": process.env.ENVIRONMENT
    });
});


app.use('/api/comprobante', require('./src/router/Comprobante'));
app.use('/api/moneda', require('./src/router/Moneda'));
app.use('/api/banco', require('./src/router/Banco'));
app.use('/api/impuesto', require('./src/router/Impuesto'));

app.use('/api/sucursal', require('./src/router/Sucursal'));
app.use('/api/categoria', require('./src/router/Categoria'));
app.use('/api/producto', require('./src/router/Producto'));
app.use('/api/almacen', require('./src/router/Almacen'));

app.use('/api/cliente', require('./src/router/Cliente'));
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

/**
 * 
 */
// app.use((req, res, next) => {
//     res.sendFile(path.join(__dirname, "..", "app/build", "index.html"));
// });

// // Se ejecuta cuando los clientes se conectan
// io.on("connection", (socket) => {
//     console.log(io.of("/").adapter);
//     socket.on("joinRoom", ({ username, room }) => {
//         const user = userJoin(socket.id, username, room);

//         socket.join(user.room);

//         // Mensaje de bienvenida
//         socket.emit("message", formatMessage(botName, "Welcome to ChatCord!"));

//         // Se emite un mensaje cuando un cliente se conecta
//         socket.broadcast
//             .to(user.room)
//             .emit(
//                 "message",
//                 formatMessage(botName, `${user.username} has joined the chat`)
//             );

//         // Enviar información de usuarios y salas
//         io.to(user.room).emit("roomUsers", {
//             room: user.room,
//             users: getRoomUsers(user.room),
//         });
//     });

//     // Se listan los mensaje guardados
//     socket.on("chatMessage", (msg) => {
//         const user = getCurrentUser(socket.id);

//         io.to(user.room).emit("message", formatMessage(user.username, msg));
//     });

//     // Se ejecuta cuando un cliente se desconecta
//     socket.on("disconnect", () => {
//         const user = userLeave(socket.id);

//         if (user) {
//             io.to(user.room).emit(
//                 "message",
//                 formatMessage(botName, `${user.username} has left the chat`)
//             );

//             // Enviar información de usuarios y salas
//             io.to(user.room).emit("roomUsers", {
//                 room: user.room,
//                 users: getRoomUsers(user.room),
//             });
//         }
//     });
// });

/**
 * 
 */
// server.listen(app.get("port"), "192.168.101.2",() => {
//     console.log(`El servidor está corriendo en el puerto ${app.get("port")}`);
// });
app.listen(app.get("port"), () => {
    console.log(`El servidor está corriendo en el puerto ${app.get("port")}`);
});