const CryptoJS = require("crypto-js");

function decrypt(datacrypt, keysecret,) {
    const bytes = CryptoJS.AES.decrypt(datacrypt, keysecret);
    const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    return decryptedData;
}

module.exports = { decrypt };