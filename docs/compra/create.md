# Función: create

Registra una nueva compra en el sistema, valida si está asociada a una orden de compra, actualiza inventario y kardex, y gestiona la transacción dependiendo de si es contado o crédito.

---

## 📄 Descripción general

- Método: `POST`
- Módulo: `Compra`
- Nombre de la función: `create`
- Tipo: `asíncrona`
- Controlador: sí

---

## 📥 Parámetros recibidos (`req.body`)

| Campo             | Descripción                                           |
|------------------|--------------------------------------------------------|
| idComprobante     | ID del comprobante asociado                           |
| idProveedor       | ID del proveedor                                      |
| idUsuario         | ID del usuario que registra la compra                 |
| idSucursal        | ID de la sucursal                                     |
| idAlmacen         | ID del almacén                                        |
| idMoneda          | ID de la moneda                                       |
| idOrdenCompra     | (Opcional) ID de la orden de compra                   |
| observacion       | Observación de la compra                              |
| nota              | Nota de la transacción                                |
| estado            | Estado del comprobante                                |
| detalles          | Lista de productos y/o servicios comprados            |
| idFormaPago       | ID de la forma de pago (`FP0001` contado, `FP0002` crédito) |
| bancosAgregados   | Lista de bancos si es pago contado                    |
| numeroCuotas      | Número de cuotas si es pago a crédito                 |
| frecuenciaPago    | Frecuencia de pago                                    |
| notaTransacion    | Nota adicional en transacción                         |
| importeTotal      | Importe total de la compra                            |

---

## 🧩 Tablas involucradas

### 📘 Consultadas (`SELECT`)
- `compra`
- `comprobante`
- `ordenCompraDetalle`
- `producto`
- `precio`
- `inventario`
- `kardex`
- `transaccion`
- `transaccionDetalle`
- `plazo`
- `compraOrdenCompra`
- `compraDetalle`
- `lote` (por `LAST_INSERT_ID()`)

### ➕ Insertadas (`INSERT INTO`)
- `compra`
- `compraDetalle`
- `kardex`
- `lote`
- `transaccion`
- `transaccionDetalle`
- `plazo`
- `compraOrdenCompra`

### ✏️ Actualizadas (`UPDATE`)
- `inventario`
- `producto`

---

## 🛠️ Lógica principal

### 1. **Validación de orden de compra (si aplica)**
- Consulta los productos ya comprados (`compraOrdenCompra`, `compraDetalle`, `producto`)
- Compara contra los productos pendientes de la orden
- Verifica cantidad y coincidencia exacta

### 2. **Registro de la compra**
- Genera `idCompra`, `numeracion`, y guarda en tabla `compra`

### 3. **Detalle de productos**
- Calcula costo promedio ponderado
- Inserta en `compraDetalle`
- Registra en `kardex`
- Actualiza `inventario`
- Si hay lotes, registra en `lote` y en `kardex`

### 4. **Pago contado**
- Inserta en `transaccion` y `transaccionDetalle`

### 5. **Pago a crédito**
- Calcula fechas futuras
- Inserta en tabla `plazo`

### 6. **Asociación con orden de compra (si aplica)**
- Inserta en `compraOrdenCompra`

---

## ✅ Resultado

- Retorna un objeto JSON con `idCompra` y un mensaje de confirmación.
- Si falla alguna validación o hay error, revierte transacción y responde con error controlado.

---

## 🧠 Consideraciones

- Usa control de transacción (`beginTransaction`, `commit`, `rollback`)
- Es altamente acoplado al flujo de negocio de compra
- Es dependiente de identificadores codificados (`FP0001`, `TT0001`, `MK0002`, etc.)

---

## 📚 Recomendaciones

- Extraer parte del cálculo de costos o validaciones a funciones auxiliares.
- Documentar los tipos esperados en `detalles`, `bancosAgregados`, etc.
- Centralizar generación de IDs (puede modularizarse).

---
