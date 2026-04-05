
module.exports = ({ conec }) => async function dashboard(data) {
    const { month, year, idSucursal } = data;

    const result = await conec.procedureAll(`CALL Dashboard_CPESunat(?,?,?)`, [
        month,
        year,
        idSucursal,
    ]);

    return {
        "ventas": result[0] ?? [],
        "ventasCompras": result[1] ?? [],
    };
}
