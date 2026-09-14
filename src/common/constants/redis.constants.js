const crypto = require('crypto');

const redisKeys = {
    PRODUCT_FILTER_WEB: (filterData) => {
        const hash = crypto
            .createHash('md5')
            .update(JSON.stringify(filterData))
            .digest('hex');

        return `cache:v1:${process.env.DB_NAME}:producto:web:filter:${hash}`;
    },

    PRODUCT_FILTER_WEB_ID: (idProducto) =>
        `cache:v1:${process.env.DB_NAME}:producto:web:${idProducto}`,

    PRODUCT_FILTER_WEB_RELATED_ID: (idProducto, idCategoria) =>
        `cache:v1:${process.env.DB_NAME}:producto:web:related:${idProducto}:${idCategoria}`,
};

module.exports = redisKeys;