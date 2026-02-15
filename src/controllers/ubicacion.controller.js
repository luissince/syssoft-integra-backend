const ubicacionService = require("../services/ubicacion.service");
const { sendSuccess, sendError, sendSave } = require("../tools/Message");

class UbicacionController {

  async list(req, res) {
    try {
      const { opcion, buscar, posicionPagina, filasPorPagina } = req.query;

      const data = await ubicacionService.list(
        parseInt(opcion),
        buscar,
        parseInt(posicionPagina),
        parseInt(filasPorPagina)
      );

      return sendSuccess(res, data);

    } catch (error) {
      return sendError(res, "Error en listar ubicaciones.", "Ubicacion/list", error);
    }
  }


  async id(req, res) {
    try {
      const data = await ubicacionService.id(req.params.idUbicacion);

      return sendSuccess(res, data);
    } catch (error) {
      return sendError(res, "Error al obtener la ubicación.", "Ubicacion/id", error);
    }
  }


  async add(req, res) {
    try {
      const message = await ubicacionService.add(req.body);

      return sendSave(res, message);
    } catch (error) {
      return sendError(res, "Error al registrar ubicación.", "Ubicacion/add", error);
    }
  }


  async edit(req, res) {
    try {
      const message = await ubicacionService.edit(req.body);

      return sendSave(res, message);
    } catch (error) {
      return sendError(res, "Error al actualizar ubicación.", "Ubicacion/edit", error);
    }
  }


  async delete(req, res) {
    try {
      const message = await ubicacionService.delete(req.params.idUbicacion);

      return sendSave(res, message);
    } catch (error) {
      return sendError(res, "Error al eliminar ubicación.", "Ubicacion/delete", error);
    }
  }


  async combo(_, res) {
    try {
      const result = await ubicacionService.combo();
      
      return sendSuccess(res, result);
    } catch (error) {
      return sendError(res, "Error al obtener combo.", "Ubicacion/combo", error);
    }
  }
}

module.exports = new UbicacionController();
