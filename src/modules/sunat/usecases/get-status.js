module.exports = ({ axios }) => async function getStatus(data) {
    const { ruc, usuario, clave, tipoComprobante, serie, numeracion } = data;
    
    const options = {
        method: 'POST',
        url: `${process.env.APP_CPE_SUNAT}/api/v1/consultar`,
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
            "cdr": ""
        },
    };

    const response = await axios.request(options);

    return response.data;
}