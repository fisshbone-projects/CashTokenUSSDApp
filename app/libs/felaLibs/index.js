const { redisClient } = require("../../../config/redisConnectConfig");
const { FelaMarketPlace, App } = require("../../../config/index");
// const moment = require("moment");
const { APP_PREFIX_REDIS } = require("../../utils");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
const API_DATA_EXPIRE_TIME = parseInt(App.REDIS_API_DATA_EXPIRE);

function getAirtimeProviders() {
  return new Promise((resolve) => {
    redisClient
      .existsAsync(`${APP_PREFIX_REDIS}:AirtimeProvidersNames`)
      .then(async (resp) => {
        if (resp === 0) {
          await fetchAirtimeProviders();
        }

        let providersName = await redisClient.zrangeAsync(
          `${APP_PREFIX_REDIS}:AirtimeProvidersNames`,
          0,
          -1
        );
        let providersCode = await redisClient.zrangeAsync(
          `${APP_PREFIX_REDIS}:AirtimeProvidersCodes`,
          0,
          -1
        );

        resolve({ providersName, providersCode });
      });
  });
}

async function fetchAirtimeProviders() {
  return new Promise((resolve) => {
    axios
      .get(`${FelaMarketPlace.BASE_URL}/list/airtimeProviders`, {
        headers: felaHeader,
      })
      .then(async (response) => {
        let airtimeProvidersArray = Object.values(response.data.data);

        for (let [index, provider] of airtimeProvidersArray.entries()) {
          let code = ++index;
          await redisClient.zaddAsync(
            `${APP_PREFIX_REDIS}:AirtimeProvidersNames`,
            code,
            provider.title
          );
          redisClient.expire(
            `${APP_PREFIX_REDIS}:AirtimeProvidersNames`,
            API_DATA_EXPIRE_TIME
          );

          await redisClient.zaddAsync(
            `${APP_PREFIX_REDIS}:AirtimeProvidersCodes`,
            code,
            provider.code
          );
          redisClient.expire(
            `${APP_PREFIX_REDIS}:AirtimeProvidersCodes`,
            API_DATA_EXPIRE_TIME
          );
        }

        console.log("Done fetching airtimeProviders");

        resolve();
      });
  });
}

module.exports = { getAirtimeProviders };
