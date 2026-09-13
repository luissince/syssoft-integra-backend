module.exports = ({ conec }) => async function createDepreciacion(data) {
    // let connection = null;

    // const MS_DIA = 1000 * 60 * 60 * 24;

    // const diasEntre = (f1, f2) => Math.ceil((f2 - f1) / MS_DIA);

    // const esBisiesto = (year) =>
    //     (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);

    // try {
    //     const { idProducto, serie } = data;

    //     connection = await conec.beginTransaction();

    //     const [activo] = await conec.execute(connection, `
    //     SELECT 
    //         k.idKardex,
    //         i.idProducto,
    //         ia.serie,
    //         k.costo,
    //         ia.vidaUtil,
    //         ia.valorResidual,
    //         ia.fechaDepreciacion,
    //         p.idMetodoDepreciacion
    //     FROM 
    //         kardex k
    //     JOIN 
    //         inventario i ON k.idInventario = i.idInventario
    //     JOIN 
    //         producto p ON p.idProducto = i.idProducto
    //     JOIN 
    //         inventarioActivo ia ON ia.idInventario = i.idInventario
    //     WHERE 
    //         i.idProducto = ? AND ia.serie = ?`, [
    //         idProducto, 
    //         serie
    //     ]);

    //     if (!activo) {
    //         throw new Error("Activo no encontrado");
    //     }

    //     const costo = Number(activo.costo);
    //     const residual = Number(activo.valorResidual || 0);
    //     const vidaUtil = Number(activo.vidaUtil);
    //     const metodo = activo.idMetodoDepreciacion;

    //     const depreciable = costo - residual;

    //     let valorInicio = costo;
    //     let acumulada = 0;

    //     const registros = [];

    //     let fechaInicio = new Date(activo.fechaDepreciacion);

    //     // 👉 Fecha fin real (vida útil completa)
    //     const fechaFinTotal = new Date(fechaInicio);
    //     fechaFinTotal.setFullYear(fechaFinTotal.getFullYear() + vidaUtil);

    //     // =========================
    //     // MÉTODOS
    //     // =========================

    //     let i = 0;

    //     while (fechaInicio < fechaFinTotal) {

    //         let finPeriodo = new Date(fechaInicio.getFullYear(), 11, 31);

    //         // 🔴 último periodo real
    //         if (finPeriodo > fechaFinTotal) {
    //             finPeriodo = fechaFinTotal;
    //         }

    //         const dias = diasEntre(fechaInicio, finPeriodo);
    //         const diasAnio = esBisiesto(fechaInicio.getFullYear()) ? 366 : 365;

    //         let depreciacion = 0;

    //         // =========================
    //         // MD0001 - LINEA RECTA
    //         // =========================
    //         if (metodo === "MD0001") {

    //             const depDiaria = depreciable / (vidaUtil * 365);
    //             depreciacion = depDiaria * dias;
    //         }

    //         // =========================
    //         // MD0002 - DOBLE SALDO
    //         // =========================
    //         if (metodo === "MD0002") {

    //             const tasaAnual = 2 / vidaUtil;
    //             const tasaDiaria = tasaAnual / diasAnio;

    //             depreciacion = valorInicio * tasaDiaria * dias;
    //         }

    //         // =========================
    //         // MD0003 - SUMA DIGITOS
    //         // =========================
    //         if (metodo === "MD0003") {

    //             const suma = (vidaUtil * (vidaUtil + 1)) / 2;

    //             const factorAnual = (vidaUtil - i) / suma;
    //             const depAnual = depreciable * factorAnual;

    //             depreciacion = (depAnual / diasAnio) * dias;
    //         }

    //         // 🔴 ajuste para no bajar del residual
    //         if ((acumulada + depreciacion) > depreciable) {
    //             depreciacion = depreciable - acumulada;
    //         }

    //         acumulada += depreciacion;

    //         let valorLibros = costo - acumulada;

    //         if (valorLibros < residual) {
    //             valorLibros = residual;
    //         }

    //         registros.push({
    //             periodo: finPeriodo.toISOString().slice(0, 10),
    //             valorInicio: Number(valorInicio.toFixed(2)),
    //             depreciacion: Number(depreciacion.toFixed(2)),
    //             depreciacionAcumulada: Number(acumulada.toFixed(2)),
    //             valorLibros: Number(valorLibros.toFixed(2))
    //         });

    //         valorInicio = valorLibros;

    //         // siguiente periodo inicia 1 enero o siguiente día
    //         fechaInicio = new Date(finPeriodo);
    //         fechaInicio.setDate(fechaInicio.getDate() + 1);

    //         i++;
    //     }

    //     // =========================
    //     // INSERTAR
    //     // =========================
    //     for (const item of registros) {
    //         await conec.execute(connection, `
    //         INSERT INTO activoDepreciacion(
    //             idProducto,
    //             serie,
    //             periodo,
    //             valorInicio,
    //             depreciacion,
    //             depreciacionAcumulada,
    //             valorLibros
    //         ) VALUES (?,?,?,?,?,?,?)`, [
    //             idProducto,
    //             serie,
    //             item.periodo,
    //             item.valorInicio,
    //             item.depreciacion,
    //             item.depreciacionAcumulada,
    //             item.valorLibros
    //         ]);
    //     }

    //     await conec.commit(connection);

    //     return "";
    // } catch (error) {
    //     if (connection != null) {
    //         await conec.rollback(connection);
    //     }
    //     throw error;
    // }
    let connection = null;

    const esBisiesto = (year) =>
        (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);

    try {
        const { idProducto, serie } = data;

        connection = await conec.beginTransaction();

        const [activo] = await conec.execute(connection, `
        SELECT 
            i.idProducto,
            ia.serie,
            ia.costo,
            ia.vidaUtil,
            ia.valorResidual,
            ia.fechaDepreciacion,
            p.idMetodoDepreciacion
        FROM 
            inventarioactivo ia
        JOIN 
            inventario i on i.idInventario = ia.idInventario
        JOIN 
            producto p on p.idProducto = i.idProducto
        WHERE 
            i.idProducto = ? AND ia.serie = ? `, [
            idProducto,
            serie
        ]);

        if (!activo) {
            throw new Error("Activo no encontrado");
        }

        // =====================================================
        // DATOS DEL ACTIVO
        // =====================================================

        const costo = Number(activo.costo);
        const residual = Number(activo.valorResidual || 0);
        const vidaUtil = Number(activo.vidaUtil);
        const metodo = activo.idMetodoDepreciacion;

        const depreciable = costo - residual;

        const registros = [];

        // Acumulada AL INICIO del primer período
        let acumulada = 0;

        // Fecha real de depreciación
        const fechaDepreciacionReal = new Date(activo.fechaDepreciacion);

        // =====================================================
        // FECHA FIN TOTAL
        // =====================================================

        const fechaFinTotal = new Date(fechaDepreciacionReal);

        fechaFinTotal.setFullYear(fechaFinTotal.getFullYear() + vidaUtil);

        /*
         * IMPORTANTE:
         *
         * Según la lógica del Excel:
         *
         * si la fechaDepreciacion es:
         *
         * 07/03/2026
         *
         * marzo se calcula completo.
         *
         * Por eso el cálculo empieza realmente:
         *
         * 01/03/2026
         */
        let fechaInicio = new Date(
            fechaDepreciacionReal.getFullYear(),
            fechaDepreciacionReal.getMonth(),
            1
        );

        const nombresMeses = [
            "enero",
            "febrero",
            "marzo",
            "abril",
            "mayo",
            "junio",
            "julio",
            "agosto",
            "septiembre",
            "octubre",
            "noviembre",
            "diciembre"
        ];

        let i = 0;

        // =====================================================
        // GENERAR PERIODOS
        // =====================================================

        while (fechaInicio < fechaFinTotal) {

            const anioPeriodo = fechaInicio.getFullYear();

            /*
             * La depreciación acumulada que guardaremos
             * corresponde a lo acumulado ANTES de comenzar
             * este período.
             */
            const acumuladaInicioPeriodo = acumulada;

            /*
             * El valorInicio también queda fijo durante
             * todo este período.
             */
            const valorInicio = Math.max(
                costo - acumuladaInicioPeriodo,
                residual
            );

            // =================================================
            // FIN DEL PERIODO
            // =================================================

            let finPeriodo = new Date(
                anioPeriodo,
                11,
                31
            );

            // Último período de la vida útil
            if (finPeriodo > fechaFinTotal) {
                finPeriodo = new Date(fechaFinTotal);
            }

            // =================================================
            // MESES
            // =================================================

            const meses = {
                enero: 0,
                febrero: 0,
                marzo: 0,
                abril: 0,
                mayo: 0,
                junio: 0,
                julio: 0,
                agosto: 0,
                septiembre: 0,
                octubre: 0,
                noviembre: 0,
                diciembre: 0
            };

            let diasPeriodo = 0;
            let depreciacionPeriodo = 0;

            const mesInicio = fechaInicio.getMonth();
            const mesFin = finPeriodo.getMonth();

            // =================================================
            // RECORRER MESES DEL PERIODO
            // =================================================

            for (let mes = mesInicio; mes <= mesFin; mes++) {

                const ultimoDiaMes = new Date(
                    anioPeriodo,
                    mes + 1,
                    0
                ).getDate();

                const diasMes = ultimoDiaMes;

                /*
                 * Último mes de toda la depreciación.
                 *
                 * Si la vida útil termina, por ejemplo:
                 *
                 * 07/03/2036
                 *
                 * marzo tendrá solamente 7 días.
                 */
                // if (
                //     anioPeriodo === fechaFinTotal.getFullYear() &&
                //     mes === fechaFinTotal.getMonth()
                // ) {
                //     diasMes = fechaFinTotal.getDate();
                // }

                let depreciacionMes = 0;

                // =============================================
                // MD0001 - LINEA RECTA
                // =============================================

                if (metodo === "MD0001") {

                    const depDiaria = depreciable / (vidaUtil * 365);

                    depreciacionMes = depDiaria * diasMes;
                }

                // =============================================
                // MD0002 - DOBLE SALDO
                // =============================================

                else if (metodo === "MD0002") {

                    const diasAnio = esBisiesto(anioPeriodo) ? 366 : 365;

                    const tasaAnual = 2 / vidaUtil;

                    const tasaDiaria = tasaAnual / diasAnio;

                    /*
                     * Por ahora utilizamos valorInicio
                     * fijo durante todo el período.
                     */
                    depreciacionMes = valorInicio * tasaDiaria * diasMes;
                }

                // =============================================
                // MD0003 - SUMA DIGITOS
                // =============================================

                else if (metodo === "MD0003") {

                    const diasAnio = esBisiesto(anioPeriodo) ? 366 : 365;

                    const suma = (vidaUtil * (vidaUtil + 1)) / 2;

                    const factorAnual = (vidaUtil - i) / suma;

                    const depAnual = depreciable * factorAnual;

                    depreciacionMes = (depAnual / diasAnio) * diasMes;
                }

                else {
                    throw new Error(
                        `Método de depreciación no soportado: ${metodo}`
                    );
                }

                // =============================================
                // REDONDEO IGUAL QUE EXCEL
                // =============================================

                depreciacionMes = Number(depreciacionMes.toFixed(2));

                meses[nombresMeses[mes]] = depreciacionMes;

                diasPeriodo += diasMes;

                depreciacionPeriodo += depreciacionMes;
            }

            /*
             * Como estamos sumando meses ya redondeados,
             * la depreciación anual se obtiene de esa suma.
             */
            depreciacionPeriodo = Number(depreciacionPeriodo.toFixed(2));

            // =================================================
            // NO SUPERAR EL VALOR DEPRECIABLE
            // =================================================

            const maximoDisponible = Number((depreciable - acumuladaInicioPeriodo).toFixed(2));

            if (depreciacionPeriodo > maximoDisponible) {

                const diferencia = Number((depreciacionPeriodo - maximoDisponible).toFixed(2));

                /*
                 * Ajustamos el último mes que tenga
                 * depreciación.
                 */
                for (let mes = 11; mes >= 0; mes--) {

                    const nombreMes =
                        nombresMeses[mes];

                    if (meses[nombreMes] > 0) {

                        meses[nombreMes] = Number(
                            Math.max(
                                meses[nombreMes] -
                                diferencia,
                                0
                            ).toFixed(2)
                        );

                        break;
                    }
                }

                depreciacionPeriodo = maximoDisponible;
            }

            // =================================================
            // ACUMULADA AL FINAL DEL PERIODO
            // =================================================

            const acumuladaFinPeriodo = Number((acumuladaInicioPeriodo + depreciacionPeriodo).toFixed(2));

            // =================================================
            // VALOR EN LIBROS
            // =================================================

            let valorLibros = Number((costo - acumuladaFinPeriodo).toFixed(2));

            if (valorLibros < residual) {
                valorLibros = residual;
            }

            // =================================================
            // GUARDAR REGISTRO
            // =================================================

            registros.push({

                periodo: finPeriodo.toISOString().slice(0, 10),

                dias: diasPeriodo,

                valorInicio: Number(valorInicio.toFixed(2)),

                enero: meses.enero,
                febrero: meses.febrero,
                marzo: meses.marzo,
                abril: meses.abril,
                mayo: meses.mayo,
                junio: meses.junio,
                julio: meses.julio,
                agosto: meses.agosto,
                septiembre: meses.septiembre,
                octubre: meses.octubre,
                noviembre: meses.noviembre,
                diciembre: meses.diciembre,

                depreciacion: depreciacionPeriodo,

                /*
                 * IMPORTANTE:
                 *
                 * Primer período = 0
                 *
                 * Segundo período =
                 * depreciación del período anterior.
                 *
                 * Tercer período =
                 * suma de períodos anteriores.
                 */
                depreciacionAcumulada:
                    Number(
                        acumuladaInicioPeriodo.toFixed(2)
                    ),

                valorLibros:
                    Number(
                        valorLibros.toFixed(2)
                    )
            });

            // =================================================
            // PREPARAR SIGUIENTE PERIODO
            // =================================================

            acumulada =
                acumuladaFinPeriodo;

            /*
             * Después del primer período,
             * todos los siguientes empiezan
             * el 1 de enero.
             */
            fechaInicio = new Date(
                anioPeriodo + 1,
                0,
                1
            );

            i++;
        }

        // =====================================================
        // INSERTAR EN BASE DE DATOS
        // =====================================================

        for (const item of registros) {

            await conec.execute(connection, `
            INSERT INTO activoDepreciacion(
                idProducto,
                serie,
                periodo,
                dias,
                costoFijo,
                valorInicio,
                enero,
                febrero,
                marzo,
                abril,
                mayo,
                junio,
                julio,
                agosto,
                septiembre,
                octubre,
                noviembre,
                diciembre,
                depreciacion,
                depreciacionAcumulada,
                valorLibros
            ) VALUES ( ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? ) `, [
                idProducto,
                serie,

                item.periodo,
                item.dias,
                costo,
                item.valorInicio,

                item.enero,
                item.febrero,
                item.marzo,
                item.abril,
                item.mayo,
                item.junio,
                item.julio,
                item.agosto,
                item.septiembre,
                item.octubre,
                item.noviembre,
                item.diciembre,

                item.depreciacion,
                item.depreciacionAcumulada,
                item.valorLibros
            ]);
        }

        await conec.commit(connection);

        return "";

    } catch (error) {

        if (connection != null) {
            await conec.rollback(connection);
        }

        throw error;
    }
}