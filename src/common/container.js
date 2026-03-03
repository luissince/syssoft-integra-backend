const conec = require("../database/mysql-connection");
const firebaseService = require("./fire-base");
const { default: axios } = require('axios');

module.exports = {
  conec,
  firebaseService,
  axios
};
