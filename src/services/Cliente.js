const { currentDate, currentTime, generateAlphanumericCode } = require('../tools/Tools');
const Conexion = require('../database/Conexion');
const conec = new Conexion();

class Cliente {
    /**
     * Metodo usado en el modulo facturación/clientes.
     * @param {*} req 
     * @returns object | string
     */
    async list(req) {
        try {
            const lista = await conec.query(`SELECT *
                FROM(
                    SELECT 
                    cn.idCliente ,             
                    td.nombre as tipodocumento,
                    cn.documento,
                    cn.informacion,
                    cn.celular,
                    cn.telefono,
                    cn.direccion,
                    cn.predeterminado,
                    cn.estado,
                    cn.fecha,
                    cn.hora
                    FROM clienteNatural AS cn
                    INNER JOIN tipoDocumento AS td ON td.idTipoDocumento = cn.idTipoDocumento 
                    UNION 
                    SELECT 
                    cj.idCliente,             
                    td.nombre as tipodocumento,
                    cj.documento,
                    cj.informacion,
                    cj.celular,
                    cj.telefono,
                    cj.direccion,
                    0 AS predeterminado,
                    cj.estado,
                    cj.fecha,
                    cj.hora                    
                    FROM clienteJuridico AS cj
                    INNER JOIN tipoDocumento AS td ON td.idTipoDocumento = cj.idTipoDocumento 
                ) AS ac      
                WHERE 
                ? = 0 
                OR
                ? = 1 and ac.documento like concat(?,'%') 
                OR
                ? = 1 and ac.informacion like concat('%',?,'%')
                
                ORDER BY ac.fecha ASC, ac.hora ASC
                LIMIT ?,?`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar,

                parseInt(req.query.opcion),
                req.query.buscar,

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ])


            const resultLista = lista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.query(`SELECT COUNT(*) AS Total 
                FROM clienteNatural AS c
                INNER JOIN tipoDocumento AS td ON td.idTipoDocumento = c.idTipoDocumento               
                WHERE 
                ? = 0 
                OR
                ? = 1 and c.documento like concat(?,'%') 
                OR
                ? = 1 and c.informacion like concat('%',?,'%')`, [
                parseInt(req.query.opcion),

                parseInt(req.query.opcion),
                req.query.buscar,

                parseInt(req.query.opcion),
                req.query.buscar,
            ]);

            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {
            console.log(error)
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async listsocios(req) {
        try {
            let lista = await conec.procedure(`CALL Listar_Socios(?,?,?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idConcepto,
                req.query.idSucursal,

                parseInt(req.query.posicionPagina),
                parseInt(req.query.filasPorPagina)
            ]);

            let newLista = [];

            for (let value of lista) {
                let detalle = await conec.query(`SELECT 
                    l.descripcion,
                    m.nombre AS categoria
                    FROM venta AS v
                    INNER JOIN ventaDetalle AS vd ON vd.idVenta = v.idVenta
                    INNER JOIN producto AS l ON l.idProducto = vd.idProducto
                    INNER JOIN categoria AS m ON m.idCategoria = l.idCategoria
                    WHERE v.idVenta = ?`, [
                    value.idVenta
                ]);

                newLista.push({
                    ...value,
                    detalle
                });
            }

            const resultLista = newLista.map(function (item, index) {
                return {
                    ...item,
                    id: (index + 1) + parseInt(req.query.posicionPagina)
                }
            });

            const total = await conec.procedure(`CALL Listar_Socios_Count(?,?,?,?,?,?)`, [
                parseInt(req.query.opcion),
                req.query.buscar,
                req.query.fechaInicio,
                req.query.fechaFinal,
                req.query.idConcepto,
                req.query.idSucursal
            ]);

            return { "result": resultLista, "total": total[0].Total };
        } catch (error) {
            console.error(error);
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async add(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            if (req.body.tipo === 1) {
                const validate = await conec.execute(connection, `SELECT * FROM clienteNatural WHERE documento = ?`, [
                    req.body.documento,
                ]);

                if (validate.length > 0) {
                    await conec.rollback(connection);
                    return `El número de documento a ingresar ya se encuentre registrado con los datos de ${validate[0].informacion}`;
                }

                const result = await conec.execute(connection, 'SELECT idCliente FROM clienteNatural');
                const idCliente = generateAlphanumericCode("CN0001", result, 'idCliente');

                await conec.execute(connection, `INSERT INTO clienteNatural(
                    idCliente, 
                    idTipoDocumento,
                    documento,
                    informacion,
                    celular,
                    telefono,
                    fechaNacimiento,
                    email, 
                    genero, 
                    direccion,
                    idUbigeo, 
                    estadoCivil,
                    predeterminado,
                    estado, 
                    observacion,
                    fecha,
                    hora,
                    fupdate,
                    hupdate,
                    idUsuario)
                    VALUES(?, ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                    idCliente,
                    req.body.idTipoDocumento,
                    req.body.documento,
                    req.body.informacion,
                    req.body.celular,
                    req.body.telefono,
                    req.body.fechaNacimiento,
                    req.body.email,
                    req.body.genero,
                    req.body.direccion,
                    req.body.idUbigeo,
                    req.body.estadoCivil,
                    req.body.predeterminado,
                    req.body.estado,
                    req.body.observacion,
                    currentDate(),
                    currentTime(),
                    currentDate(),
                    currentTime(),
                    req.body.idUsuario,
                ])

                await conec.commit(connection);
                return "insert";
            } else {
                const validate = await conec.execute(connection, `SELECT * FROM clienteJuridico WHERE documento = ?`, [
                    req.body.documento,
                ]);

                if (validate.length > 0) {
                    await conec.rollback(connection);
                    return `El número de documento a ingresar ya se encuentre registrado con los datos de ${validate[0].informacion}`;
                }

                const result = await conec.execute(connection, 'SELECT idCliente FROM clienteJuridico');
                let idCliente = "CJ0001";

                if (result.length != 0) {
                    const quitarValor = result.map(item => parseInt(item.idCliente.replace("CJ", '')));
                    const incremental = Math.max(...quitarValor) + 1;
                    const formattedIncremental = String(incremental).padStart(4, '0'); // Formatea el número con ceros a la izquierda si es necesario
                    idCliente = `CJ${formattedIncremental}`;
                }

                await conec.execute(connection, `INSERT INTO clienteJuridico(
                    idCliente, 
                    idTipoDocumento,
                    documento,
                    informacion,
                    celular,
                    telefono,
                    email,
                    direccion,
                    idUbigeo,
                    estado,
                    fecha,
                    hora,
                    fupdate,
                    hupdate,
                    idUsuario)
                    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                    idCliente,
                    req.body.idTipoDocumento,
                    req.body.documento,
                    req.body.informacion,
                    req.body.celular,
                    req.body.telefono,
                    req.body.email,
                    req.body.direccion,
                    req.body.idUbigeo,
                    req.body.estado,
                    currentDate(),
                    currentTime(),
                    currentDate(),
                    currentTime(),
                    req.body.idUsuario,
                ])

                await conec.commit(connection);
                return "insert";
            }
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            console.log(error)
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async id(req) {
        try {
            const result = await conec.query(`SELECT *
            FROM (
                SELECT 
                cn.idCliente,
                cn.idTipoDocumento,
                cn.documento,
                cn.informacion,
                cn.celular,
                cn.telefono, 
                DATE_FORMAT(cn.fechaNacimiento,'%Y-%m-%d') as fechaNacimiento,
                cn.email, 
                cn.genero,  
                cn.direccion,
                IFNULL(cn.idUbigeo,0) AS idUbigeo,
                IFNULL(u.ubigeo, '') AS ubigeo,
                IFNULL(u.departamento, '') AS departamento,
                IFNULL(u.provincia, '') AS provincia,
                IFNULL(u.distrito, '') AS distrito,
                cn.estadoCivil,
                cn.predeterminado,
                cn.estado, 
                cn.observacion
                FROM clienteNatural AS cn 
                LEFT JOIN ubigeo AS u ON u.idUbigeo = cn.idUbigeo

                UNION

                SELECT 
                cj.idCliente,
                cj.idTipoDocumento,
                cj.documento,
                cj.informacion,
                cj.celular,
                cj.telefono, 
                null AS fechaNacimiento,
                cj.email, 
                null AS genero,  
                cj.direccion,
                IFNULL(cj.idUbigeo,0) AS idUbigeo,
                IFNULL(u.ubigeo, '') AS ubigeo,
                IFNULL(u.departamento, '') AS departamento,
                IFNULL(u.provincia, '') AS provincia,
                IFNULL(u.distrito, '') AS distrito,
                null AS estadoCivil,
                0 AS predeterminado,
                cj.estado, 
                null AS observacion
                FROM clienteJuridico AS cj 
                LEFT JOIN ubigeo AS u ON u.idUbigeo = cj.idUbigeo
            ) ac
            WHERE 
            ac.idCliente = ?`, [
                req.query.idCliente,
            ]);

            if (result.length > 0) {
                return result[0];
            } else {
                return "Datos no encontrados";
            }
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async update(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            if (req.body.tipo === 1) {
                const validate = await conec.execute(connection, `SELECT * FROM clienteNatural WHERE idCliente <> ? AND documento = ?`, [
                    req.body.idCliente,
                    req.body.documento,
                ]);

                if (validate.length > 0) {
                    await conec.rollback(connection);
                    return `El número de documento a ingresar ya se encuentre registrado con los datos de ${validate[0].informacion}`;
                }

                if (req.body.predeterminado) {
                    await conec.execute(connection, `UPDATE clienteNatural SET predeterminado = 0`);
                }

                await conec.execute(connection, `UPDATE clienteNatural SET
                idTipoDocumento=?, 
                documento=?,
                informacion=?, 
                celular=?,
                telefono=?,
                fechaNacimiento=?,
                email=?,
                genero=?, 
                direccion=?, 
                idUbigeo=?,
                estadoCivil=?, 
                predeterminado=?,
                estado=?,
                observacion=?,
                fupdate=?,
                hupdate=?,
                idUsuario=?
                WHERE idCliente=?`, [
                    req.body.idTipoDocumento,
                    req.body.documento,
                    req.body.informacion,
                    req.body.celular,
                    req.body.telefono,
                    req.body.fechaNacimiento,
                    req.body.email,
                    req.body.genero,
                    req.body.direccion,
                    req.body.idUbigeo,
                    req.body.estadoCivil,
                    req.body.predeterminado,
                    req.body.estado,
                    req.body.observacion,
                    currentDate(),
                    currentTime(),
                    req.body.idUsuario,
                    req.body.idCliente
                ]);

                await conec.commit(connection)
                return "update";

            } else {

                const validate = await conec.execute(connection, `SELECT * FROM clienteJuridico WHERE idCliente <> ? AND documento = ?`, [
                    req.body.idCliente,
                    req.body.documento,
                ]);

                if (validate.length > 0) {
                    await conec.rollback(connection);
                    return `El número de documento a ingresar ya se encuentre registrado con los datos de ${validate[0].informacion}`;
                }

                if (req.body.predeterminado) {
                    await conec.execute(connection, `UPDATE clienteJuridico SET predeterminado = 0`);
                }

                await conec.execute(connection, `UPDATE clienteJuridico SET
                idTipoDocumento=?, 
                documento=?,
                informacion=?, 
                celular=?,
                telefono=?,
                email=?, 
                direccion=?, 
                idUbigeo=?,
                estado=?,
                fupdate=?,
                hupdate=?,
                idUsuario=?
                WHERE idCliente=?`, [
                    req.body.idTipoDocumento,
                    req.body.documento,
                    req.body.informacion,
                    req.body.celular,
                    req.body.telefono,
                    req.body.email,
                    req.body.direccion,
                    req.body.idUbigeo,
                    req.body.estado,
                    currentDate(),
                    currentTime(),
                    req.body.idUsuario,
                    req.body.idCliente
                ]);

                await conec.commit(connection)
                return "update";

            }

        } catch (error) {
            console.log(error)
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async delete(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const cobro = await conec.execute(connection, `SELECT * FROM cobro WHERE idCliente = ?`, [
                req.query.idCliente
            ]);

            if (cobro.length > 0) {
                await conec.rollback(connection);
                return 'No se puede eliminar el cliente ya que esta ligada a un cobro.';
            }

            const gasto = await conec.execute(connection, `SELECT * FROM gasto WHERE idCliente = ?`, [
                req.query.idCliente
            ]);

            if (gasto.length > 0) {
                await conec.rollback(connection);
                return 'No se puede eliminar el cliente ya que esta ligada a un gasto.';
            }

            const venta = await conec.execute(connection, `SELECT * FROM venta WHERE idCliente = ?`, [
                req.query.idCliente
            ]);

            if (venta.length > 0) {
                await conec.rollback(connection);
                return 'No se puede eliminar el cliente ya que esta ligada a una venta.';
            }

            if (req.query.idCliente.startsWith("CN")) {
                console.log("CN")
                await conec.execute(connection, `DELETE FROM clienteNatural WHERE idCliente  = ?`, [
                    req.query.idCliente
                ]);
            } else {
                console.log("CJ")
                await conec.execute(connection, `DELETE FROM clienteJuridico WHERE idCliente  = ?`, [
                    req.query.idCliente
                ]);
            }


            await conec.commit(connection);
            return "delete";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async listcombo(req) {
        try {
            const result = await conec.query('SELECT idCliente, documento, informacion FROM clienteNatural');
            return result;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async filtrar(req) {
        try {
            const result = await conec.query(`SELECT *
            FROM (
                SELECT 
                cn.idCliente, 
                cn.documento, 
                cn.informacion
                FROM clienteNatural AS cn

                UNION

                SELECT 
                cj.idCliente, 
                cj.documento, 
                cj.informacion
                FROM clienteJuridico AS cj
            ) ac
            WHERE 
            ac.documento LIKE CONCAT('%',?,'%')
            OR 
            ac.informacion LIKE CONCAT('%',?,'%')`, [
                req.query.filtrar,
                req.query.filtrar,
            ]);
            return result;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async predeterminado(req) {
        try {
            const result = await conec.query(`
            SELECT 
            idCliente, 
            documento, 
            informacion
            FROM clienteNatural
            WHERE predeterminado = 1`);
            if (result.length !== 0) {
                return result[0];
            }
            return "";
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async listadeudas(req) {
        try {
            const lista = await conec.query(`SELECT 
            v.idVenta, 
            cl.idCliente,
            cl.documento, 
            cl.informacion, 
            cm.nombre, 
            v.serie, 
            v.numeracion, 
            (SELECT IFNULL(COUNT(*), 0) FROM plazo AS p WHERE p.estado = 0 AND p.idVenta = v.idVenta) AS numCuota, 
            CASE 
            WHEN v.credito = 1 THEN DATE_ADD(v.fecha,interval v.frecuencia day)
            ELSE (SELECT IFNULL(MIN(p.fecha),'') FROM plazo AS p WHERE p.estado = 0 AND p.idVenta = v.idVenta) END AS fechaPago,
            v.fecha, 
            v.hora, 
            v.estado,
            v.credito,
            v.frecuencia,
            m.codiso,
            IFNULL(SUM(vd.precio*vd.cantidad),0) AS total,
            (
             SELECT IFNULL(SUM(cv.precio),0) 
             FROM cobro AS c 
             LEFT JOIN notaCredito AS nc ON c.idCobro = nc.idCobro AND nc.estado = 1
             LEFT JOIN cobroVenta AS cv ON c.idCobro = cv.idCobro 
             WHERE c.idProcedencia = v.idVenta AND c.estado = 1 AND nc.idNotaCredito IS NULL
            ) AS cobrado 
            FROM venta AS v 
            INNER JOIN moneda AS m ON m.idMoneda = v.idMoneda
            INNER JOIN comprobante AS cm ON v.idComprobante = cm.idComprobante 
            INNER JOIN clienteNatural AS cl ON v.idCliente = cl.idCliente 
            LEFT JOIN ventaDetalle AS vd ON vd.idVenta = v.idVenta 
            WHERE  
            ? = 1 AND v.estado = 2 AND v.idSucursal = ?
            OR
            ? = 0 AND v.estado = 2 AND v.frecuencia = ? AND v.idSucursal = ?

            GROUP BY v.idVenta
            ORDER BY cl.informacion ASC`, [
                req.query.seleccionado,
                req.query.idSucursal,

                req.query.seleccionado,
                req.query.frecuencia,
                req.query.idSucursal
            ]);

            let newLista = []

            for (let value of lista) {
                let detalle = await conec.query(`SELECT 
                l.descripcion AS producto,
                m.nombre AS categoria
                FROM ventaDetalle AS vd 
                INNER JOIN producto AS l ON vd.idProducto = l.idProducto 
                INNER JOIN categoria AS m ON l.idCategoria = m.idCategoria
                WHERE vd.idVenta = ? `, [
                    value.idVenta
                ]);

                const producto = detalle.map(item => {
                    return item.producto + "\n" + item.categoria
                });

                newLista.push({
                    ...value,
                    producto: producto.join(", ")
                });
            }

            return newLista;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async listapagos(req) {
        try {

            const ventas = await conec.query(`SELECT 
            v.idVenta,
            co.nombre AS comprobante,
            v.serie,
            v.numeracion,
            DATE_FORMAT(v.fecha,'%d/%m/%Y') as fecha, 
            v.hora
            FROM venta AS v
            INNER JOIN comprobante AS co ON co.idComprobante  = v.idComprobante 
            WHERE v.idCliente = ? AND v.estado <> 3`, [
                req.query.idCliente,
            ]);

            let newVentas = [];

            for (const venta of ventas) {
                const detalle = await conec.query(`SELECT 
                l.descripcion AS producto,
                m.nombre AS categoria,
                vd.precio,
                vd.cantidad
                FROM ventaDetalle AS vd
                INNER JOIN producto AS l ON vd.idProducto = l.idProducto
                INNER JOIN categoria AS m ON m.idCategoria = l.idCategoria
                WHERE vd.idVenta = ?`, [
                    venta.idVenta
                ]);

                newVentas.push({
                    ...venta,
                    "detalle": detalle
                });
            }
            return newVentas;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    /**
     * Metodo usado en el modulo facturación/clientes/detalle.
     * @param {*} req 
     * @returns object | string
     */
    async listventasasociadas(req) {
        try {

            let cliente

            if(req.query.idCliente.startsWith("CN")){
                cliente = await conec.query(`select
                tp.nombre as tipoDocumento,
                c.documento,
                c.informacion,
                c.celular,
                c.telefono,
                c.email,
                c.direccion
                from 
                clienteNatural as c 
                inner join tipoDocumento as tp on tp.idTipoDocumento = c.idTipoDocumento
                where c.idCliente = ?`, [
                req.query.idCliente,
            ]);
            } else{
                cliente = await conec.query(`select
                tp.nombre as tipoDocumento,
                c.documento,
                c.informacion,
                c.celular,
                c.telefono,
                c.email,
                c.direccion
                from 
                clienteJuridico as c 
                inner join tipoDocumento as tp on tp.idTipoDocumento = c.idTipoDocumento
                where c.idCliente = ?`, [
                req.query.idCliente,
            ]);
            }
            

            if (cliente.length > 0) {
                const ventas = await conec.query(`select 
                    v.idVenta,
                    co.nombre as comprobante,
                    v.serie,
                    v.numeracion,
                    DATE_FORMAT(v.fecha,'%d/%m/%Y') as fecha, 
                    v.hora,
                    sum(vd.cantidad * vd.precio) as total
                    from venta as v
                    inner join ventaDetalle as vd on vd.idVenta = v.idVenta
                    inner join comprobante as co on co.idComprobante = v.idComprobante
                    where v.idCliente = ? and v.estado in (1,2)
                    group by v.idVenta
                    order by v.fecha desc, v.hora desc`, [
                    req.query.idCliente,
                ]);

                let newVentas = [];

                for (const venta of ventas) {
                    const detalle = await conec.query(`select 
                        l.descripcion,
                        m.nombre as categoria,
                        p.nombre as sucursal,
                        im.porcentaje,
                        im.nombre as impuesto,
                        vd.cantidad,
                        vd.precio
                        from ventaDetalle as vd
                        inner join impuesto as im on im.idImpuesto = vd.idImpuesto
                        inner join producto as l on l.idProducto = vd.idProducto
                        inner join categoria as m on m.idCategoria = l.idCategoria
                        inner join sucursal as p on p.idSucursal = m.idSucursal
                        where vd.idVenta = ?`, [
                        venta.idVenta
                    ]);

                    newVentas.push({
                        ...venta,
                        "detalle": detalle
                    });
                }

                return { "cliente": cliente[0], "venta": newVentas };
            } else {
                return "Datos no encontrados";
            }
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async listcobrosasociados(req) {
        try {
            let detalle = await conec.query(`SELECT 
            c.idCobro,
            DATE_FORMAT(c.fecha,'%d/%m/%Y') as fecha, 
            c.hora,
            com.nombre as comprobante,
            c.serie,
            c.numeracion,

            co.nombre as concepto,
            m.codiso,
            cd.precio,
            cd.cantidad

            FROM cobroDetalle AS cd 
            INNER JOIN cobro AS c ON cd.idCobro = c.idCobro
            INNER JOIN moneda AS m ON c.idMoneda = m.idMoneda
            INNER JOIN comprobante as com on com.idComprobante = c.idComprobante
            INNER JOIN clienteNatural AS cl ON c.idCliente = cl.idCliente
            INNER JOIN concepto AS co ON cd.idConcepto = co.idConcepto
            WHERE cl.idCliente = ? AND co.idConcepto = ?
            ORDER BY c.fecha DESC, c.hora DESC`, [
                req.query.idCliente,
                req.query.idConcepto,
            ]);

            return detalle;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async updatealta(req) {
        let connection = null;
        try {
            connection = await conec.beginTransaction();

            const venta = await conec.execute(connection, `SELECT * FROM venta WHERE idSucursal = ?`, [
                req.query.idSucursal
            ]);
            for (let value of venta) {
                const alta = await conec.execute(connection, `SELECT * FROM alta WHERE idCliente = ? AND idSucursal = ?`, [
                    value.idCliente,
                    value.idSucursal
                ]);
                if (alta.length == 0) {
                    let resultAlta = await conec.execute(connection, 'SELECT idAlta FROM alta');
                    let idAlta = 0;
                    if (resultAlta.length != 0) {
                        let quitarValor = resultAlta.map(function (item) {
                            return parseInt(item.idAlta);
                        });

                        let valorActual = Math.max(...quitarValor);
                        let incremental = valorActual + 1;

                        idAlta = incremental;
                    } else {
                        idAlta = 1;
                    }

                    await conec.execute(connection, `INSERT INTO alta(
                        idAlta,
                        idCliente,
                        idSucursal,
                        fecha,
                        hora,
                        idUsuario
                    ) VALUES(?,?,?,?,?,?)`, [
                        idAlta,
                        value.idCliente,
                        value.idSucursal,
                        currentDate(),
                        currentTime(),
                        'US0001'
                    ]);
                }
            }

            await conec.commit(connection);
            return "ok";
        } catch (error) {
            if (connection != null) {
                await conec.rollback(connection);
            }
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    async listarsociosporfecha(req) {
        try {

            const clientes = await conec.query(`SELECT 
                cl.idCliente,
                cl.documento,
                cl.informacion,
                cl.celular,
                cl.telefono,
                cl.email,
                v.serie,
                v.numeracion,
                DATE_FORMAT(v.fecha,'%d/%m/%Y') AS fecha,
                CASE WHEN v.frecuencia = 30 THEN 'CADA FIN DE MES'
                ELSE 'CADA QUINCENA DE CADA MES' END AS frecuencia, 
                lo.descripcion AS producto,
                ma.nombre AS categoria,
                mo.codiso,
                SUM(vd.cantidad * vd.precio) AS monto
                FROM venta AS v 
                INNER JOIN clienteNatural AS cl ON cl.idCliente = v.idCliente
                INNER JOIN moneda AS mo ON mo.idMoneda = v.idMoneda
                INNER JOIN ventaDetalle AS vd ON vd.idVenta = v.idVenta
                INNER JOIN producto AS lo ON vd.idProducto = lo.idProducto
                INNER JOIN categoria AS ma ON ma.idCategoria = lo.idCategoria
                WHERE 
                YEAR(v.fecha) = ? AND v.idSucursal = ? AND ? = 0 AND v.estado IN (1,2)
                OR
                YEAR(v.fecha) = ? AND ? = 1 AND v.estado IN (1,2)
                GROUP BY v.idVenta`, [
                parseInt(req.query.yearPago),
                req.query.idSucursal,
                parseInt(req.query.porSucursal),

                parseInt(req.query.yearPago),
                parseInt(req.query.porSucursal),
            ]);

            let newClientes = [];

            for (const cliente of clientes) {
                if (!this.duplicate(newClientes, cliente.idCliente)) {
                    newClientes.push({
                        "idCliente": cliente.idCliente,
                        "documento": cliente.documento,
                        "informacion": cliente.informacion,
                        "celular": cliente.celular,
                        "telefono": cliente.telefono,
                        "email": cliente.email,
                        "detalle": []
                    });
                }
            }

            for (const cliente of newClientes) {
                let count = 0;
                for (const venta of clientes) {
                    if (venta.idCliente == cliente.idCliente) {
                        count++;
                        cliente.detalle.push({
                            "id": count,
                            "serie": venta.serie,
                            "numeracion": venta.numeracion,
                            "fecha": venta.fecha,
                            "frecuencia": venta.frecuencia,
                            "producto": venta.producto,
                            "categoria": venta.categoria,
                            "codiso": venta.codiso,
                            "monto": venta.monto,
                        });
                    }
                }
            }

            return newClientes;
        } catch (error) {
            return "Se produjo un error de servidor, intente nuevamente.";
        }
    }

    duplicate(clientes, idCliente) {
        let value = false;
        for (const item of clientes) {
            if (item.idCliente == idCliente) {
                value = true;
                break;
            }
        }
        return value;
    }

}


module.exports = Cliente;