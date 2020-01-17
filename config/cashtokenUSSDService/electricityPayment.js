const { redisClient } = require("../redisConnectConfig");
const { FelaMarketPlace } = require("../index");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };

async function processElectricity(text, phoneNumber, sessionId) {
  return new Promise(async (resolve, reject) => {
    console.log("Starting the Electricity bill payment process");
    let response = "";
    if (text === "2*3") {
      response = `Select your Disco:`;
      resolve(response);
    }
  });
}

async function fetchDiscoDetails() {
  axios
    .get(`${FelaMarketPlace.BASE_URL}/list/electricityProviders`, {
      headers: felaHeader
    })
    .then(async response => {
      let discos = response.data.data;
      let prepaidScore = 1;
      let postpaidScore = 1;

      let keys = Object.keys(discos);
      for (let key of keys) {
        let packages = discos[key].packages;

        for (let item of packages) {
          if (item.code === "prepaid") {
            await redisClient.zaddAsync(
              `CELDUSSD:Discos:Prepaid:Title`,
              prepaidScore,
              `${discos[key].title}`
            );
            await redisClient.zaddAsync(
              `CELDUSSD:Discos:Prepaid:Code`,
              prepaidScore,
              `${discos[key].code}`
            );
            ++prepaidScore;
          }
          if (item.code === "postpaid") {
            await redisClient.zaddAsync(
              `CELDUSSD:Discos:Postpaid:Title`,
              postpaidScore,
              `${discos[key].title}`
            );
            await redisClient.zaddAsync(
              `CELDUSSD:Discos:Postpaid:Code`,
              postpaidScore,
              `${discos[key].code}`
            );
            postpaidScore++;
          }
        }
      }
    })
    .catch(error => {
      console.log("error");
      console.log(JSON.stringify(error.response.data, null, 2));
    });
}

fetchDiscoDetails();

module.exports = {
  processElectricity
};
