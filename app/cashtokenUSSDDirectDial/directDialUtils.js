const axios = require("axios");
const { redisClient } = require("../../config/redisConnectConfig");
const { FelaMarketPlace } = require("../../config/index");
const { App } = require("../../config");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };

let DIRECTDIALSERVICE = {
  CASHOUT: "01",
};
Object.freeze(DIRECTDIALSERVICE);

async function checkUserActivationStatus(phoneNumber) {
  return new Promise((resolve, reject) => {
    axios
      .get(
        `${FelaMarketPlace.BASE_URL}/info/felaWallet?accountId=${phoneNumber}`,
        {
          headers: felaHeader,
        }
      )
      .then(async (response) => {
        console.log(JSON.stringify(response.data, null, 2));
        resolve({
          status: response.data.data.status,
          name: response.data.data.name,
        });
      })
      .catch((e) => {
        console.log(e);
        // console.log(e.response.data);
        resolve({ status: "inactive" });
      });
  });
}

async function getBankCodes() {
  return new Promise((resolve, reject) => {
    axios
      .get(`${FelaMarketPlace.BASE_URL}/list/banks`, {
        headers: felaHeader,
      })
      .then((response) => {
        // console.log(JSON.stringify(response.data, null, 2));
        let bankArray = Object.values(response.data.data);
        bankArray.forEach(async (bank) => {
          await redisClient.zaddAsync(
            `CELDUSSD:BankCodes`,
            bank.code,
            bank.title
          );
          redisClient.expire(`CELDUSSD:BankCodes`, App.REDIS_API_DATA_EXPIRE);
          resolve();
        });
      })
      .catch((error) => {
        console.log("error");
        console.log(JSON.stringify(error.response.data, null, 2));
      });
  });
}

module.exports = {
  DIRECTDIALSERVICE,
  checkUserActivationStatus,
  getBankCodes,
};
