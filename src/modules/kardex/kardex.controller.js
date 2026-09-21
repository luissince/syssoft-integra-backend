
const kardex = require("./kardex.service");
const { makeController, asyncHandler } = require("../../tools/AsyncHandler");

module.exports = {
    findAll: makeController(kardex.findAll, (req) => req.query),
    metricsDepreciations: makeController(kardex.metricsDepreciations, (req) => req.query),
    findAllAsset: makeController(kardex.findAllAsset, (req) => req.query),
    findAllDepreciations: makeController(kardex.findAllDepreciations, (req) => req.body),
    createDepreciations: makeController(kardex.createDepreciations, (req) => req.body),
    detailDepreciations: makeController(kardex.detailDepreciations, (req) => req.body),
    findAllDepreciationsToReturn: makeController(kardex.findAllDepreciationsToReturn, (req) => req.body),
    reportDepreciations: makeController(kardex.reportDepreciations, (req) => req.body),
    excelDepreciations: asyncHandler(async (req, res) => {
        const workbook = await kardex.excelDepreciations(req.body);

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        res.setHeader(
            'Content-Disposition',
            'attachment; filename="reporte-depreciacion.xlsx"'
        );


        await workbook.xlsx.write(res);

        res.end();
    }),
};
