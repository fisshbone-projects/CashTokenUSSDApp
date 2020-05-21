const { redisClient } = require("$config/redisConnectConfig");
const { FelaMarketPlace, App, LCC_PROVIDER_CODE } = require("$config/index");
// const moment = require("moment");
const { APP_PREFIX_REDIS } = require("$utils");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
const API_DATA_EXPIRE_TIME = parseInt(App.REDIS_API_DATA_EXPIRE);

async function confirmMeterNo(meterNumber, electricPlan, discoCode) {
  return new Promise((resolve) => {
    console.log(electricPlan, discoCode, meterNumber);
    axios
      .get(
        `https://api.myfela.ng/info/meterNo?number=${meterNumber}&provider_code=${discoCode}&service_code=${electricPlan}`,
        {
          headers: {
            Authorization: `Bearer eca76401-2cb0-4c64-a125-709d2c1e5ad8 `,
          },
        }
      )
      .then(async (resp) => {
        console.log(resp.data);
        if (resp.status === 200) {
          if (
            resp.data.message.includes("Meter number resolved successfully")
          ) {
            let minimumAmount = parseInt(resp.data.data.customer.minimumAmount);

            resolve({ verified: true, minimumAmount });
          } else {
            resolve({ verified: false, minimumAmount: 0 });
          }
        } else {
          resolve({ verified: false, minimumAmount: 0 });
        }
      })
      .catch((error) => {
        console.log(error);
        resolve({ verified: false, minimumAmount: 0 });
      });
  });
}

async function displayListOfDiscos(plan) {
  return new Promise(async (resolve) => {
    let response = "";
    if (plan === "prepaid") {
      response += await displayDisco("Prepaid");
      resolve(response);
    } else {
      response += await displayDisco("Postpaid");
      resolve(response);
    }

    function displayDisco(planType) {
      return new Promise(async (resolve) => {
        let response = "";
        let index = 1;
        let infoExists = await redisClient.existsAsync(
          `${APP_PREFIX_REDIS}:Discos:${planType}:Title`
        );

        if (infoExists === 0) {
          await fetchDiscoDetails();
        }

        let listOfDiscos = await redisClient.zrangeAsync(
          `${APP_PREFIX_REDIS}:Discos:${planType}:Title`,
          0,
          -1
        );

        for (let disco of listOfDiscos) {
          response += `${index++} ${refineDiscoName(disco)}\n`;
        }
        resolve(response);
      });
    }

    function refineDiscoName(disco) {
      let refine1 = disco.replace(/ /g, "");
      let refine2 = refine1.replace("Electricity", "");
      let refine3 = refine2.replace(")", "");
      let refine4 = refine3.replace("(", ":");

      return refine4;
    }
  });
}

async function fetchDiscoDetails() {
  return new Promise((resolve) => {
    axios
      .get(`https://api.myfela.ng/list/electricityProviders`, {
        headers: {
          Authorization: `Bearer eca76401-2cb0-4c64-a125-709d2c1e5ad8 `,
        },
      })
      .then(async (response) => {
        let discos = response.data.data;
        let prepaidScore = 1;
        let postpaidScore = 1;

        let keys = Object.keys(discos);
        for (let key of keys) {
          let packages = discos[key].packages;

          for (let item of packages) {
            if (item.code === "prepaid") {
              await redisClient.zaddAsync(
                `${APP_PREFIX_REDIS}:Discos:Prepaid:Title`,
                prepaidScore,
                `${discos[key].title}`
              );
              await redisClient.zaddAsync(
                `${APP_PREFIX_REDIS}:Discos:Prepaid:Code`,
                prepaidScore,
                `${discos[key].code}`
              );

              redisClient.expire(
                `${APP_PREFIX_REDIS}:Discos:Prepaid:Code`,
                API_DATA_EXPIRE_TIME
              );
              redisClient.expire(
                `${APP_PREFIX_REDIS}:Discos:Prepaid:Code`,
                API_DATA_EXPIRE_TIME
              );
            }

            if (item.code === "postpaid") {
              await redisClient.zaddAsync(
                `${APP_PREFIX_REDIS}:Discos:Postpaid:Title`,
                postpaidScore,
                `${discos[key].title}`
              );
              await redisClient.zaddAsync(
                `${APP_PREFIX_REDIS}:Discos:Postpaid:Code`,
                postpaidScore,
                `${discos[key].code}`
              );
              redisClient.expire(
                `${APP_PREFIX_REDIS}:Discos:Postpaid:Title`,
                API_DATA_EXPIRE_TIME
              );
              redisClient.expire(
                `${APP_PREFIX_REDIS}:Discos:Postpaid:Code`,
                API_DATA_EXPIRE_TIME
              );
            }
          }
          prepaidScore++;
          postpaidScore++;
        }
        resolve();
      })
      .catch((error) => {
        console.log("error");
        console.log(JSON.stringify(error.response.data, null, 2));
        resolve();
      });
  });
}

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
  displayListOfDiscos,
  confirmMeterNo,
};
