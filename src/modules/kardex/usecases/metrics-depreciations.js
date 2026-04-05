const { calculateDepreciationToday } = require("../../../tools/Tools");

module.exports = ({ conec }) => async function matricsDepreciacion(data) {
    const { idAlmacen } = data;

    const result = await conec.query(`
    SELECT 
        p.idMetodoDepreciacion,
        k.fecha AS fechaAdquisicion,
        k.costo,
        k.serie,
        k.vidaUtil,
        k.valorResidual,
        SUM(
            CASE 
                WHEN k.idTipoKardex = 'TK0001' THEN k.cantidad
                ELSE -k.cantidad
            END
        ) AS cantidad
    FROM 
        kardex k
    JOIN inventario i
        ON k.idInventario = i.idInventario
    JOIN producto p 
        ON p.idProducto = i.idProducto
    JOIN almacen al 
        ON al.idAlmacen = i.idAlmacen
    WHERE 
        p.idTipoProducto = 'TP0004'
    AND
        al.idAlmacen = ?      
    GROUP BY
        k.serie
    HAVING
        cantidad > 0`, [
        idAlmacen
    ]);

    const resumen = result.reduce((acc, item) => {
        const dep = calculateDepreciationToday(item);

        acc.totalAssets += 1;
        acc.totalCost += Number(item.costo);
        acc.totalDepreciation += dep.depreciacionHoy;
        acc.totalBookValue += dep.valorLibrosHoy;

        return acc;
    }, {
        totalAssets: 0,
        totalCost: 0,
        totalDepreciation: 0,
        totalBookValue: 0
    });

    return resumen;
}