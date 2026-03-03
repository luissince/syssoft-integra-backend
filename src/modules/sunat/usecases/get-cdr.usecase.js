module.exports = ({ axios }) => async function getCdr(data) {
    const { ruc, usuario, clave, tipoComprobante, serie, numeracion } = data;

    const options = {
        method: 'POST',
        url: `${process.env.APP_CPE_SUNAT}/api/v1/cdr`,
        headers: {
            'Content-Type': 'application/json',
        },
        data: {
            "ruc": ruc,
            "usuarioSol": usuario,
            "claveSol": clave,
            "tipoComprobante": tipoComprobante,
            "serie": serie,
            "numeracion": numeracion,
        },
    };

    const response = await axios.request(options);
    return response.data;
}