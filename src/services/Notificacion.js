const conec = require('../database/mysql-connection');

class Notificacion {

    /**
     * Lista las notificaciones generales del sistema.
     *
     * Incluye:
     * - Comprobantes electrónicos pendientes de declarar.
     * - Comprobantes pendientes de baja.
     * - Guías de remisión pendientes.
     * - Alertas del certificado digital próximo a vencer o vencido.
     *
     * El certificado digital se notifica con 3 meses de anticipación
     * debido a que su renovación tiene costo y puede requerir gestión previa.
     */
    async list() {
        try {

            /**
             * Tabla temporal en memoria.
             */
            const notifications = [];

            // =========================================================
            // VENTAS
            // =========================================================

            const ventas = await conec.query(`
            SELECT 
                co.nombre,

                CASE v.estado
                    WHEN 3 THEN 'Dar de baja'
                    ELSE 'Por declarar'
                END AS estado,

                COUNT(v.serie) AS cantidad

            FROM venta AS v

            INNER JOIN comprobante AS co 
                ON co.idComprobante = v.idComprobante 
                AND co.facturado = 1 

            WHERE 
                (
                    IFNULL(v.xmlSunat,'') <> '0'
                    AND IFNULL(v.xmlSunat,'') <> '1032'
                )
                OR
                (
                    IFNULL(v.xmlSunat,'') = '0'
                    AND v.estado = 3
                )

            GROUP BY 
                co.nombre,
                estado`);

            /**
             * Agregar ventas.
             */
            ventas.forEach(item => {

                notifications.push({
                    tipo: 'notification',

                    categoria: 'venta',

                    titulo: item.nombre.toUpperCase(),

                    subtitulo: `${item.cantidad} ${item.estado.toLowerCase()}`,

                    prioridad: 'warning',

                    route: '/invoices'
                });

            });

            // =========================================================
            // GUÍAS
            // =========================================================

            const guias = await conec.query(`
            SELECT 
                co.nombre,

                CASE gr.estado
                    WHEN 3 THEN 'Dar de baja'
                    ELSE 'Por declarar'
                END AS estado,

                COUNT(gr.serie) AS cantidad

            FROM guiaRemision AS gr

            INNER JOIN comprobante AS co 
                ON co.idComprobante = gr.idComprobante 
                AND co.facturado = 1 

            WHERE 
                (
                    IFNULL(gr.xmlSunat,'') <> '0'
                    AND IFNULL(gr.xmlSunat,'') <> '1032'
                )
                OR
                (
                    IFNULL(gr.xmlSunat,'') = '0'
                    AND gr.estado = 3
                )

            GROUP BY 
                co.nombre,
                estado`);

            /**
             * Agregar guías.
             */
            guias.forEach(item => {

                notifications.push({
                    tipo: 'notification',

                    categoria: 'guia',

                    titulo: item.nombre.toUpperCase(),

                    subtitulo: `${item.cantidad} ${item.estado.toLowerCase()}`,

                    prioridad: 'warning',

                    route: '/guides'
                });

            });

            // =========================================================
            // CERTIFICADO DIGITAL
            // =========================================================

            const empresa = await conec.query(`
            SELECT 
                certificadoExpiracion
            FROM 
                empresa
            LIMIT 
                1`);

            /**
             * Validar certificado.
             */
            if (empresa[0]?.certificadoExpiracion) {

                const expiration = new Date(
                    empresa[0].certificadoExpiracion
                );

                const today = new Date();

                /**
                 * Calcular diferencia de días.
                 */
                const diffDays = Math.ceil(
                    (expiration - today) /
                    (1000 * 60 * 60 * 24)
                );

                /**
                 * Mostrar alertas desde 3 meses antes.
                 */
                if (diffDays <= 90) {

                    let message = '';

                    if (diffDays < 0) {

                        message = 'El certificado digital ha vencido';

                    } else if (diffDays <= 30) {

                        message = `Vence en ${diffDays} días`;

                    } else if (diffDays <= 60) {

                        message = 'Vence en menos de 2 meses';

                    } else {

                        message = 'Vence en menos de 3 meses';
                    }

                    notifications.push({
                        tipo: 'notification',

                        categoria: 'certificado',

                        titulo: 'CERTIFICADO DIGITAL',

                        subtitulo: message,

                        prioridad: diffDays < 0
                            ? 'danger'
                            : 'warning',

                        route: '/settings/certificate'
                    });
                }
            }

            /**
             * Retornar notificaciones.
             */
            return notifications;

        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    /**
     * Lista el detalle de notificaciones del sistema.
     *
     * Flujo:
     * 1. Obtener notificaciones desde distintas fuentes.
     * 2. Normalizar estructura.
     * 3. Crear tabla temporal en memoria.
     * 4. Ordenar resultados.
     * 5. Aplicar paginación manual.
     * 6. Retornar resultado final.
     */
    async detail(req) {
        try {

            /**
             * Variables de paginación.
             */
            const posicionPagina = parseInt(
                req.query.posicionPagina
            );

            const filasPorPagina = parseInt(
                req.query.filasPorPagina
            );

            /**
             * Tabla temporal en memoria.
             */
            const notifications = [];

            // =========================================================
            // VENTAS
            // =========================================================

            const ventas = await conec.query(`
            SELECT 
                v.idVenta AS referenceId,

                v.fecha AS fechaOrder,

                DATE_FORMAT(v.fecha, '%Y-%m-%d') AS fecha,

                v.hora,

                co.nombre AS titulo,

                CONCAT(v.serie, '-', v.numeracion) AS descripcion,

                CASE v.estado
                    WHEN 3 THEN 'DAR DE BAJA'
                    ELSE 'POR DECLARAR'
                END AS subtitulo,

                CASE v.estado
                    WHEN 3 THEN 'danger'
                    ELSE 'warning'
                END AS prioridad

            FROM venta AS v

            INNER JOIN comprobante AS co 
                ON co.idComprobante = v.idComprobante
                AND co.facturado = 1

            WHERE
                (
                    IFNULL(v.xmlSunat,'') <> '0'
                    AND IFNULL(v.xmlSunat,'') <> '1032'
                )
                OR
                (
                    IFNULL(v.xmlSunat,'') = '0'
                    AND v.estado = 3
                )
            `);

            /**
             * Normalizar ventas.
             */
            ventas.forEach(item => {

                notifications.push({
                    tipo: 'notification',

                    categoria: 'venta',

                    titulo: item.titulo,

                    subtitulo: item.subtitulo,

                    descripcion: item.descripcion,

                    fecha: item.fecha,

                    hora: item.hora,

                    fechaOrder: item.fechaOrder,

                    prioridad: item.prioridad,

                    route: `/inicio/cpesunat/cpeelectronicos?comprobante=${item.descripcion}`,

                    referenceId: item.referenceId
                });

            });

            // =========================================================
            // GUÍAS
            // =========================================================

            const guias = await conec.query(`
            SELECT 
                gu.idGuiaRemision AS referenceId,

                gu.fecha AS fechaOrder,

                DATE_FORMAT(gu.fecha, '%Y-%m-%d') AS fecha,

                gu.hora,

                co.nombre AS titulo,

                CONCAT(gu.serie, '-', gu.numeracion) AS descripcion,

                CASE gu.estado
                    WHEN 3 THEN 'DAR DE BAJA'
                    ELSE 'POR DECLARAR'
                END AS subtitulo,

                CASE gu.estado
                    WHEN 3 THEN 'danger'
                    ELSE 'warning'
                END AS prioridad

            FROM guiaRemision AS gu

            INNER JOIN comprobante AS co 
                ON co.idComprobante = gu.idComprobante
                AND co.facturado = 1

            WHERE
                (
                    IFNULL(gu.xmlSunat,'') <> '0'
                    AND IFNULL(gu.xmlSunat,'') <> '1032'
                )
                OR
                (
                    IFNULL(gu.xmlSunat,'') = '0'
                    AND gu.estado = 3
                )
            `);

            /**
             * Normalizar guías.
             */
            guias.forEach(item => {

                notifications.push({
                    tipo: 'notification',

                    categoria: 'guia',

                    titulo: item.titulo,

                    subtitulo: item.subtitulo,

                    descripcion: item.descripcion,

                    fecha: item.fecha,

                    hora: item.hora,

                    fechaOrder: item.fechaOrder,

                    prioridad: item.prioridad,

                    route: `/inicio/cpesunat/cpeelectronicos?comprobante=${item.descripcion}`,

                    referenceId: item.referenceId
                });

            });

            // =========================================================
            // CERTIFICADO DIGITAL
            // =========================================================

            const empresa = await conec.query(`
            SELECT 
                certificadoExpiracion
            FROM 
                empresa
            LIMIT 1`);

            /**
             * Validar certificado.
             */
            if (empresa[0]?.certificadoExpiracion) {

                const expiration = new Date(
                    empresa[0].certificadoExpiracion
                );

                const today = new Date();

                /**
                 * Diferencia de días.
                 */
                const diffDays = Math.ceil(
                    (expiration - today) /
                    (1000 * 60 * 60 * 24)
                );

                /**
                 * Mostrar alertas desde 3 meses antes.
                 */
                if (diffDays <= 90) {

                    notifications.push({
                        tipo: 'notification',

                        categoria: 'certificado',

                        titulo: 'CERTIFICADO DIGITAL',

                        subtitulo: diffDays < 0
                            ? 'VENCIDO'
                            : 'PRÓXIMO A VENCER',

                        descripcion: diffDays < 0
                            ? 'El certificado digital ha vencido'
                            : `El certificado vence en ${diffDays} días`,

                        fecha: expiration.toISOString().slice(0, 10),

                        hora: expiration.toTimeString().slice(0, 8),

                        fechaOrder: expiration,

                        prioridad: diffDays < 0
                            ? 'danger'
                            : 'warning',

                        route: '/inicio/configuracion/empresa',

                        referenceId: null
                    });
                }
            }

            // =========================================================
            // ORDENAR
            // =========================================================

            notifications.sort(
                (a, b) =>
                    new Date(b.fechaOrder) -
                    new Date(a.fechaOrder)
            );

            // =========================================================
            // TOTAL
            // =========================================================

            const total = notifications.length;

            // =========================================================
            // PAGINACIÓN MANUAL
            // =========================================================

            const result = notifications
                .slice(
                    posicionPagina,
                    posicionPagina + filasPorPagina
                )
                .map((item, index) => ({
                    id: index + 1 + posicionPagina,
                    ...item
                }));

            // =========================================================
            // RESPUESTA
            // =========================================================

            return {
                result,
                total
            };

        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

}

module.exports = Notificacion;