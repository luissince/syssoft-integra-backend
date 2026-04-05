module.exports = ({ conec }) => async function createDepreciacion(data) {
    let connection = null;

    const MS_DIA = 1000 * 60 * 60 * 24;

    const diasEntre = (f1, f2) => Math.ceil((f2 - f1) / MS_DIA);

    const esBisiesto = (year) =>
        (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);

    try {
        const { idProducto, serie } = data;

        connection = await conec.beginTransaction();

        const [activo] = await conec.execute(connection, `
        SELECT 
            k.idKardex,
            i.idProducto,
            k.serie,
            k.costo,
            k.vidaUtil,
            k.valorResidual,
            k.fecha,
            p.idMetodoDepreciacion
        FROM 
            kardex k
        JOIN 
            inventario i ON k.idInventario = i.idInventario
        JOIN 
            producto p ON p.idProducto = i.idProducto
        WHERE 
            i.idProducto = ? AND k.serie = ?`, [
            idProducto, 
            serie
        ]);

        if (!activo) {
            throw new Error("Activo no encontrado");
        }

        const costo = Number(activo.costo);
        const residual = Number(activo.valorResidual || 0);
        const vidaUtil = Number(activo.vidaUtil);
        const metodo = activo.idMetodoDepreciacion;

        const depreciable = costo - residual;

        let valorInicio = costo;
        let acumulada = 0;

        const registros = [];

        let fechaInicio = new Date(activo.fecha);

        // 👉 Fecha fin real (vida útil completa)
        const fechaFinTotal = new Date(fechaInicio);
        fechaFinTotal.setFullYear(fechaFinTotal.getFullYear() + vidaUtil);

        // =========================
        // MÉTODOS
        // =========================

        let i = 0;

        while (fechaInicio < fechaFinTotal) {

            let finPeriodo = new Date(fechaInicio.getFullYear(), 11, 31);

            // 🔴 último periodo real
            if (finPeriodo > fechaFinTotal) {
                finPeriodo = fechaFinTotal;
            }

            const dias = diasEntre(fechaInicio, finPeriodo);
            const diasAnio = esBisiesto(fechaInicio.getFullYear()) ? 366 : 365;

            let depreciacion = 0;

            // =========================
            // MD0001 - LINEA RECTA
            // =========================
            if (metodo === "MD0001") {

                const depDiaria = depreciable / (vidaUtil * 365);
                depreciacion = depDiaria * dias;
            }

            // =========================
            // MD0002 - DOBLE SALDO
            // =========================
            if (metodo === "MD0002") {

                const tasaAnual = 2 / vidaUtil;
                const tasaDiaria = tasaAnual / diasAnio;

                depreciacion = valorInicio * tasaDiaria * dias;
            }

            // =========================
            // MD0003 - SUMA DIGITOS
            // =========================
            if (metodo === "MD0003") {

                const suma = (vidaUtil * (vidaUtil + 1)) / 2;

                const factorAnual = (vidaUtil - i) / suma;
                const depAnual = depreciable * factorAnual;

                depreciacion = (depAnual / diasAnio) * dias;
            }

            // 🔴 ajuste para no bajar del residual
            if ((acumulada + depreciacion) > depreciable) {
                depreciacion = depreciable - acumulada;
            }

            acumulada += depreciacion;

            let valorLibros = costo - acumulada;

            if (valorLibros < residual) {
                valorLibros = residual;
            }

            registros.push({
                periodo: finPeriodo.toISOString().slice(0, 10),
                valorInicio: Number(valorInicio.toFixed(2)),
                depreciacion: Number(depreciacion.toFixed(2)),
                depreciacionAcumulada: Number(acumulada.toFixed(2)),
                valorLibros: Number(valorLibros.toFixed(2))
            });

            valorInicio = valorLibros;

            // siguiente periodo inicia 1 enero o siguiente día
            fechaInicio = new Date(finPeriodo);
            fechaInicio.setDate(fechaInicio.getDate() + 1);

            i++;
        }

        // =========================
        // INSERTAR
        // =========================
        for (const item of registros) {
            await conec.execute(connection, `
            INSERT INTO activoDepreciacion(
                idProducto,
                serie,
                periodo,
                valorInicio,
                depreciacion,
                depreciacionAcumulada,
                valorLibros
            ) VALUES (?,?,?,?,?,?,?)`, [
                idProducto,
                serie,
                item.periodo,
                item.valorInicio,
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