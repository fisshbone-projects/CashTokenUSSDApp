const { redisClient } = require("$config/redisConnectConfig");
const { FelaMarketPlace, App, LCC_PROVIDER_CODE } = require("$config/index");
// const moment = require("moment");
const { APP_PREFIX_REDIS } = require("$utils");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
const API_DATA_EXPIRE_TIME = parseInt(App.REDIS_API_DATA_EXPIRE);

async function confirmSmartCardNo(smartCardNo, providerCode, bouquetCode) {
  return new Promise((resolve) => {
    console.log(smartCardNo, providerCode, bouquetCode);
    axios
      .get(
        `https://api.myfela.ng/info/tvSmartCard?number=${smartCardNo}&provider_code=${providerCode}&service_code=${bouquetCode}
        `,
        {
          headers: {
            Authorization: `Bearer eca76401-2cb0-4c64-a125-709d2c1e5ad8 `,
          },
        }
      )
      .then((resp) => {
        console.log(resp.data);
        if (resp.status === 200) {
          if (resp.data.message.includes("Smart card resolved successfully")) {
            resolve(true);
          } else {
            resolve(false);
          }
        } else {
          resolve(false);
        }
      })
      .catch((error) => {
        console.log(error);
        resolve(false);
      });
  });
}

async function displayBouquets(providerCode, providerName, start, end) {
  return new Promise(async (resolve) => {
    let bouquets = await fetchBouquets(providerCode, providerName, start, end);

    let response = "";
    let index = 0;
    bouquets.forEach((value) => {
      response += `${++index} ${value}\n`;
    });

    let rank = await redisClient.zrankAsync(
      `${APP_PREFIX_REDIS}:CableTVBouquet:${providerCode}:Name`,
      `${bouquets[bouquets.length - 1]}`
    );

    if (rank !== 0) {
      response += `${++index} Next`;
    }

    console.log(rank);

    resolve(response);
  });
}

function fetchBouquets(providerCode, providerName, start, end) {
  return new Promise(async (resolve) => {
    let cachedBouquets = await redisClient.existsAsync(
      `${APP_PREFIX_REDIS}:CableTVBouquet:${providerCode}:Name`
    );

    if (cachedBouquets === 0) {
      console.log(`Fetching bouquets for ${providerName}`);
      let callResponse = await axios.get(
        `https://api.myfela.ng/list/cableBouquets?provider_code=${providerCode}`,
        {
          headers: {
            Authorization: `Bearer eca76401-2cb0-4c64-a125-709d2c1e5ad8 `,
          },
        }
      );
      // let callResponse = await axios.get(
      //   `${FelaMarketPlace.BASE_URL}/list/cableBouquets?provider_code=${providerCode}`,
      //   {
      //     headers: felaHeader,
      //   }
      // );

      let providers = callResponse.data.data;

      for (let value of Object.values(providers)) {
        let bouquetName = "";

        switch (providerName) {
          case "DSTV":
            bouquetName = refineDSTVBouquetName(value.title);
            break;
          case "GOTV":
            bouquetName = refineGOTVBouquetName(value.title);
            break;
          default:
            bouquetName = value.title;
        }

        await redisClient.zaddAsync(
          `${APP_PREFIX_REDIS}:CableTVBouquet:${providerCode}:Name`,
          value.price,
          bouquetName
        );
        await redisClient.zaddAsync(
          `${APP_PREFIX_REDIS}:CableTVBouquet:${providerCode}:Code`,
          value.price,
          `${value.code}`
        );
      }
      redisClient.expire(
        `${APP_PREFIX_REDIS}:CableTVBouquet:${providerCode}:Name`,
        API_DATA_EXPIRE_TIME
      );
      redisClient.expire(
        `${APP_PREFIX_REDIS}:CableTVBouquet:${providerCode}:Code`,
        API_DATA_EXPIRE_TIME
      );
    }

    let response = await redisClient.zrevrangeAsync(
      `${APP_PREFIX_REDIS}:CableTVBouquet:${providerCode}:Name`,
      start,
      end
    );

    console.log(response);
    resolve(response);
  });
}

function refineDSTVBouquetName(name) {
  let refinedName = "";
  if (name.includes("HDPVR/Extraview")) {
    name = name.replace(/\s/g, "");
    name = name.replace("and", "&");
    refinedName = name.replace("Extraview", "Xtraview");
  } else if (name === "HDPVR Access_Extraview") {
    name = name.replace(/\s/g, "");
    name = name.replace("_", "");
    refinedName = name.replace("Extraview", "Xtraview");
  } else {
    refinedName = name.replace(/\s/g, "");
  }

  return refinedName;
}

function refineGOTVBouquetName(name) {
  let refinedName = "";
  if (name.includes("Gotv")) {
    console.log("In Here");
    name = name.replace(/\s/g, "");
    refinedName = name.replace("Gotv", "");
  } else if (name.includes("GOtv")) {
    name = name.replace(/\s/g, "");
    refinedName = name.replace("GOtv", "");
  } else {
    refinedName = name;
  }

  return refinedName;
}

function fetchCableProviders() {
  return new Promise(async (resolve) => {
    let cachedProviders = await redisClient.existsAsync(
      `${APP_PREFIX_REDIS}:CableTVProviders`
    );

    if (cachedProviders === 0) {
      console.log("Fetching list of cable providers");
      let callResponse = await axios.get(
        `https://api.myfela.ng/list/cableProviders`,
        {
          headers: {
            Authorization: `Bearer eca76401-2cb0-4c64-a125-709d2c1e5ad8 `,
          },
        }
      );
      // let callResponse = await axios.get(
      //   `${FelaMarketPlace.BASE_URL}/list/cableProviders`,
      //   {
      //     headers: felaHeader,
      //   }
      // );

      let providers = callResponse.data.data;

      for (let value of Object.values(providers)) {
        await redisClient.zaddAsync(
          `${APP_PREFIX_REDIS}:CableTVProviders`,
          value.code,
          `${value.title}`
        );
      }
      redisClient.expire(
        `${APP_PREFIX_REDIS}:CableTVProviders`,
        API_DATA_EXPIRE_TIME
      );
    }

    let response = await redisClient.zrangeAsync(
      `${APP_PREFIX_REDIS}:CableTVProviders`,
      0,
      -1,
      "withscores"
    );
    let providersName = [];
    let providersCode = [];

    response.forEach((value) => {
      if (Number(value)) {
        providersCode.push(value);
      } else {
        providersName.push(value);
      }
    });

    resolve({ providersCode, providersName });
  });
}

function verifyLCCAccountNo(accountNumber) {
  return new Promise((resolve) => {
    axios
      .get(
        `https://api.myfela.ng/info/tollAccountNo?provider_code=2329&account_id=${accountNumber}`,
        {
          headers: {
            Authorization: `Bearer eca76401-2cb0-4c64-a125-709d2c1e5ad8 `,
          },
        }
      )
      // .get(
      //   `${FelaMarketPlace.BASE_URL}/info/tollAccountNo?provider_code=${LCC_PROVIDER_CODE}&account_id=${accountNumber}`,
      //   {
      //     headers: {
      //       Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER} `,
      //     },
      //   }
      // )
      .then((resp) => {
        console.log(resp.data);
        if (resp.status === 200) {
          if (resp.data.message.includes("Account resolved successfully")) {
            resolve(true);
          } else {
            resolve(false);
          }
        } else {
          resolve(false);
        }
      })
      .catch((error) => {
        console.log(error);
        resolve(false);
      });
  });
}

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

module.exports = {
  getAirtimeProviders,
  verifyLCCAccountNo,
  fetchCableProviders,
  displayBouquets,
  confirmSmartCardNo,
};
