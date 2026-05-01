const conec = require('../database/mysql-connection');
const firebaseService = require('../common/fire-base');

class inventarioService {

    async list(data) {
        const {
            opcion,
            buscar,
            idAlmacen,
            estado,
            posicionPagina,
            filasPorPagina
        } = data;

        const lista = await conec.procedure(`CALL Listar_Inventario(?,?,?,?,?,?)`, [
            parseInt(opcion),
            buscar,
            idAlmacen,
            estado,
            parseInt(posicionPagina),
            parseInt(filasPorPagina)
        ]);

        const bucket = firebaseService.getBucket();

        // Genera lista con índice
        const resultLista = await Promise.all(lista.map(async (item, index) => {
            const inventarioDetalles = await conec.procedure(`CALL Listar_Inventario_Detalle(?,?)`, [
                item.idProducto,
                idAlmacen
            ]);

            return {
                ...item,
                id: (index + 1) + parseInt(posicionPagina),
                imagen: bucket && item.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : null,
                inventarioDetalles: inventarioDetalles
            };
        }));

        const total = await conec.procedure(`CALL Listar_Inventario_Count(?,?,?,?)`, [
            parseInt(opcion),
            buscar,
            idAlmacen,
            estado,
        ]);

        return { "result": resultLista, "total": total[0].Total };
    };

    async summary(data) {
        const { idAlmacen } = data;

        const result = await conec.procedureAll(`CALL Listar_Inventario_Sumatoria(?)`, [
            idAlmacen
        ]);

        return {
            totalProductos: result[0][0].Total,
            totalLotesPorVencer: result[1][0].totalLotesPorVencer,
            totalStockCritico: result[2][0].totalStockCritico,
            totalStockOptimo: result[3][0].totalStockOptimo,
            totalStockExcedente: result[4][0].totalStockExcedente,
        };
    }

    async getStock(data) {
        const { idInventario } = data;
        const result = await conec.query(`
            SELECT 
                cantidadMaxima, 
                cantidadMinima 
            FROM 
                inventario 
            WHERE 
                idInventario = ?`, [
            idInventario
        ])

        return result[0]
    }

    async updateStock(data) {
        let connection = null;
        try {
            const { idInventario, stockMaximo, stockMinimo } = data;

            connection = await conec.beginTransaction();

            await conec.execute(connection, `
            UPDATE 
                inventario 
            SET 
                cantidadMaxima = ?,
                cantidadMinima = ?
            WHERE 
                idInventario = ?`, [
                stockMaximo,
                stockMinimo,
                idInventario,
            ])

            await conec.commit(connection);
            return 'update';
        } catch (error) {

            if (connection) await conec.rollback(connection);
            throw error;
        }
    }

    async dashboard(body) {
        const { fechaInicio, fechaFinal, idSucursal } = body;
        const lista = await conec.procedureAll(`CALL Dashboard_Inventario(?,?,?)`, [
            fechaInicio,
            fechaFinal,
            idSucursal,
        ]);

        const bucket = firebaseService.getBucket();

        const productosParaPedir = lista[0].map(item => ({
            ...item,
            imagen: bucket && item.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : null,
        })) ?? [];

        const productosParaRematar = lista[1].map(item => ({
            ...item,
            imagen: bucket && item.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : null,
        })) ?? [];

        const productosDisponibles = lista[2].map(item => ({
            ...item,
            imagen: bucket && item.imagen ? `${process.env.FIREBASE_URL_PUBLIC}${bucket.name}/${item.imagen}` : null,
        })) ?? [];

        return {
            "productosParaPedir": productosParaPedir,
            "productosParaRematar": productosParaRematar,
            "productosDisponibles": productosDisponibles,
        };
    }

}

module.exports = new inventarioService();