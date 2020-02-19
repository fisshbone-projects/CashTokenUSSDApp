const { redisClient } = require("../redisConnectConfig");
const { FelaMarketPlace, App } = require("../index");
const { APP_PREFIX_REDIS } = require("../utils");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
// const NAIRASIGN = "\u{020A6}";
const NAIRASIGN = "N";
const API_DATA_EXPIRE_TIME = parseInt(App.REDIS_API_DATA_EXPIRE);

async function processData(text, phoneNumber, sessionId) {
  return new Promise(async (resolve, reject) => {
    console.log("Starting Data Purchase Process");
    let response = "";
    // if (text.startsWith("3")) {
    //   let brokenDownText = text.split("*");
    //   response = await dataFlow(brokenDownText, phoneNumber, sessionId);
    //   resolve(response);
    // }
    if (text.startsWith("3")) {
      response = `CON Welcome!!!\nThis service is still under development, but please check back soon, we are always ready to serve you.\n\n0 Menu`;
      resolve(response);
    } else {
      response = "CON An error occured, please try again\n\n0 Menu";
      resolve(response);
    }
  });
}

function testNumber(phoneNumber) {
  let regPhone1 = /^[+]{0,1}(234){1}[0-9]{10}$/;
  let regPhone2 = /^[0-9]{11}$/;

  let phoneNumberTest =
    regPhone1.test(phoneNumber) || regPhone2.test(phoneNumber);

  return phoneNumberTest;
}

async function dataFlow(brokenDownText, phoneNumber, sessionId) {
  return new Promise(async (resolve, reject) => {
    let response = "";
    let { walletPin: checkWalletPin } = await redisClient.hgetallAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`
    );
    if (brokenDownText.length === 1) {
      response = await getDataProviders();
      // response = `CON Enter Recipient's Phone Number:`;
      resolve(response);
    } else if (brokenDownText.length === 2) {
      let numberToCredit = brokenDownText[1];
      if (testNumber(numberToCredit)) {
        console.log("Number is valid");
        await redisClient.hsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "numberToCredit",
          `${numberToCredit}`
        );

        response = await showDataDeals(0, 6);
        resolve(response);
      } else {
        console.log("Number is invalid");
        response = `CON Error! Inputted number is not a valid phone number\n\n0 Menu`;
        resolve(response);
      }
    } else if (
      brokenDownText.length === 3 &&
      parseInt(brokenDownText[2], 10) <= 7 &&
      checkWalletPin === undefined
    ) {
      let selectedDataPlan = brokenDownText[2];
      await saveSelectedDataPlanDetails(selectedDataPlan, sessionId, "first");
      response = `CON Enter your wallet PIN:`;
      resolve(response);
    } else if (
      brokenDownText.length === 3 &&
      parseInt(brokenDownText[2], 10) == 8
    ) {
      response = await showDataDeals(7, 13);
      resolve(response);
    } else if (
      brokenDownText.length === 4 &&
      parseInt(brokenDownText[3], 10) <= 7 &&
      checkWalletPin === undefined
    ) {
      let selectedDataPlan = brokenDownText[3];
      await saveSelectedDataPlanDetails(selectedDataPlan, sessionId, "second");
      response = `CON Enter your wallet PIN:`;
      resolve(response);
    } else if (
      brokenDownText.length === 4 &&
      parseInt(brokenDownText[3], 10) == 8
    ) {
      response = await showDataDeals(14, -1);
      resolve(response);
    } else if (
      brokenDownText.length === 5 &&
      parseInt(brokenDownText[4], 10) <= 7 &&
      checkWalletPin === undefined
    ) {
      let selectedDataPlan = brokenDownText[4];
      await saveSelectedDataPlanDetails(selectedDataPlan, sessionId, "third");
      response = `CON Enter your wallet PIN:`;
      resolve(response);
    } else if (brokenDownText.length === 4 && brokenDownText[3].length >= 4) {
      await redisClient.hsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "walletPin",
        `${brokenDownText[3]}`
      );

      response = await displayDataPlanPurchaseSummary(sessionId);
      resolve(response);
    } else if (brokenDownText.length === 5 && brokenDownText[4].length >= 4) {
      await redisClient.hsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "walletPin",
        `${brokenDownText[4]}`
      );

      response = await displayDataPlanPurchaseSummary(sessionId);
      resolve(response);
    } else if (brokenDownText.length === 6 && brokenDownText[5].length >= 4) {
      await redisClient.hsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "walletPin",
        `${brokenDownText[5]}`
      );

      response = await displayDataPlanPurchaseSummary(sessionId);
      resolve(response);
    } else if (
      brokenDownText.length === 5 &&
      parseInt(brokenDownText[4], 10) === 1 &&
      checkWalletPin !== undefined
    ) {
      let {
        numberToCredit,
        dataPlanCode,
        dataPlanName,
        walletPin
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      let response = await processDataPurchase(
        sessionId,
        phoneNumber,
        numberToCredit,
        dataPlanCode,
        dataPlanName,
        walletPin
      );
      resolve(response);
    } else if (
      brokenDownText.length === 5 &&
      parseInt(brokenDownText[4], 10) === 2 &&
      checkWalletPin !== undefined
    ) {
      response = `CON Transaction Cancelled!\n\n0 Menu`;
      resolve(response);
    } else if (
      brokenDownText.length === 6 &&
      parseInt(brokenDownText[5], 10) === 1 &&
      checkWalletPin !== undefined
    ) {
      let {
        numberToCredit,
        dataPlanCode,
        dataPlanName,
        walletPin
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      let response = await processDataPurchase(
        sessionId,
        phoneNumber,
        numberToCredit,
        dataPlanCode,
        dataPlanName,
        walletPin
      );
      resolve(response);
    } else if (
      brokenDownText.length === 6 &&
      parseInt(brokenDownText[5], 10) === 2 &&
      checkWalletPin !== undefined
    ) {
      response = `CON Transaction Cancelled!\n\n0 Menu`;
      resolve(response);
    } else if (
      brokenDownText.length === 7 &&
      parseInt(brokenDownText[6], 10) === 1 &&
      checkWalletPin !== undefined
    ) {
      let {
        numberToCredit,
        dataPlanCode,
        dataPlanName,
        walletPin
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      let response = await processDataPurchase(
        sessionId,
        phoneNumber,
        numberToCredit,
        dataPlanCode,
        dataPlanName,
        walletPin
      );
      resolve(response);
    } else if (
      brokenDownText.length === 7 &&
      parseInt(brokenDownText[6], 10) === 2 &&
      checkWalletPin !== undefined
    ) {
      response = `CON Transaction Cancelled!\n\n0 Menu`;
      resolve(response);
    } else {
      response = "CON An error occured, please try again\n\n0 Menu";
      resolve(response);
    }
  });
}

function getDataProviders() {
  return new Promise(resolve => {
    redisClient
      .existsAsync(`${APP_PREFIX_REDIS}:DataProvidersNames`)
      .then(async resp => {
        let response = "";
        if (resp === 0) {
          await fetchDataProviders();
        }

        let providers = await redisClient.zrangeAsync(
          `${APP_PREFIX_REDIS}:DataProvidersNames`,
          0,
          -1
        );

        response = `CON Select Recipent's Network:\n`;

        providers.forEach((provider, index) => {
          response += `${++index} ${provider}\n`;
        });
        response += `# Back\n0 Main Menu`;

        resolve(response);
      });
  });
}

async function fetchDataProviders() {
  return new Promise(resolve => {
    axios
      .get(`${FelaMarketPlace.BASE_URL}/list/dataProviders`, {
        headers: {
          Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER} `
        }
      })
      .then(async response => {
        let dataProvidersArray = Object.values(response.data.data);

        for (let [index, provider] of dataProvidersArray.entries()) {
          console.log(provider);
          let code = ++index;
          await redisClient.zaddAsync(
            `${APP_PREFIX_REDIS}:DataProvidersNames`,
            code,
            provider.title
          );
          redisClient.expire(
            `${APP_PREFIX_REDIS}:DataProvidersNames`,
            API_DATA_EXPIRE_TIME
          );

          await redisClient.zaddAsync(
            `${APP_PREFIX_REDIS}:DataProvidersCodes`,
            code,
            provider.code
          );
          redisClient.expire(
            `${APP_PREFIX_REDIS}:DataProvidersCodes`,
            API_DATA_EXPIRE_TIME
          );
        }

        console.log("Done fetching dataProviders");

        resolve();
      });
  });
}

async function getAirtelDataPlans() {
  return new Promise((resolve, reject) => {
    axios
      .get(`https://api.myfela.ng/list/dataBundles?provider_code=Airtel`, {
        headers: {
          Authorization: `Bearer 04a7e2df-6821-4c64-a88b-1ff28a6ccc6c`
        }
      })
      .then(response => {
        // console.log(JSON.stringify(response.data, null, 2));
        console.log("Getting response");
        let dataBundleArray = Object.values(response.data.data);
        console.log(dataBundleArray.length);
        // console.log(response.data.data);
        dataBundleArray.forEach(async bundle => {
          await redisClient.zaddAsync(
            `${APP_PREFIX_REDIS}:AirtelDataBundleNames`,
            bundle.price,
            bundle.title
          );
          redisClient.expire(
            `${APP_PREFIX_REDIS}:AirtelDataBundleNames`,
            API_DATA_EXPIRE_TIME
          );
          await redisClient.zaddAsync(
            `${APP_PREFIX_REDIS}:AirtelDataBundleCodes`,
            bundle.price,
            bundle.code
          );
          redisClient.expire(
            `${APP_PREFIX_REDIS}:AirtelDataBundleCodes`,
            API_DATA_EXPIRE_TIME
          );
          resolve();
        });
      })
      .catch(error => {
        console.log("error");
        console.log(JSON.stringify(error.response.data, null, 2));
      });
  });
}

function showDataDeals(dataIndexStart, dataIndexEnd) {
  return new Promise(resolve => {
    redisClient
      .existsAsync(`${APP_PREFIX_REDIS}:AirtelDataBundleNames`)
      .then(async resp => {
        if (resp === 0) {
          await getAirtelDataPlans();
        }
        let dataBundles = await redisClient.zrangeAsync(
          `${APP_PREFIX_REDIS}:AirtelDataBundleNames`,
          dataIndexStart,
          dataIndexEnd,
          "withscores"
        );
        let { bundleNames, bundlePrices } = extractBundleNameAndPrice(
          dataBundles
        );
        console.log("Get: ", bundleNames);
        console.log("Get: ", bundlePrices);
        let response = `CON Select preferred Data bundle:\n`;
        bundleNames.forEach((bundle, index) => {
          response += `${index + 1} ${NAIRASIGN}${formatNumber(
            bundlePrices[index]
          )}/${bundle}\n`;
        });

        if (dataIndexEnd !== -1) {
          response += `8 Next\n0 Menu`;
        } else {
          response += `0 Menu`;
        }
        resolve(response);
      });
  });
}

function extractBundleNameAndPrice(dataBundles) {
  //   console.log(dataBundles);
  let bundleNames = dataBundles.filter(value => {
    return value.startsWith("Airtel D-MFIN");
  });
  let extractedBundleNames = [];
  bundleNames.forEach(value => {
    let name = value.split("-");
    // console.log(name);
    extractedBundleNames.push(name[3]);
  });
  console.log(extractedBundleNames);

  let bundlePrices = dataBundles.filter(value => {
    return !value.startsWith("Airtel D-MFIN");
  });
  return { bundleNames: extractedBundleNames, bundlePrices: bundlePrices };
}

function displayDataPlanPurchaseSummary(sessionId) {
  return new Promise(async (resolve, reject) => {
    let {
      numberToCredit,
      dataPlanName,
      dataPlanPrice
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

    let response = `CON Confirm your DataPlan Purchase:\nRecipient's Number: ${numberToCredit}\nDataPlan: ${dataPlanName}\nPrice: ${NAIRASIGN}${formatNumber(
      dataPlanPrice
    )}\n\n1. Confirm\n 2. Cancel`;
    resolve(response);
  });
}

function saveSelectedDataPlanDetails(selectedDataPlan, sessionId, iteration) {
  return new Promise(async (resolve, reject) => {
    redisClient
      .existsAsync(`${APP_PREFIX_REDIS}:AirtelDataBundleNames`)
      .then(async resp => {
        if (resp === 0) {
          await getAirtelDataPlans();
        }
        let chosenData = "";
        if (iteration === "first") {
          chosenData = parseInt(selectedDataPlan, 10);
          chosenData -= 1;
        } else if (iteration === "second") {
          chosenData = parseInt(selectedDataPlan, 10);
          chosenData += 6;
        } else if (iteration === "third") {
          chosenData = parseInt(selectedDataPlan, 10);
          chosenData += 13;
        }
        let dataPlanCode = await redisClient.zrangeAsync(
          `${APP_PREFIX_REDIS}:AirtelDataBundleCodes`,
          chosenData,
          chosenData
        );
        let dataPlanName = await redisClient.zrangeAsync(
          `${APP_PREFIX_REDIS}:AirtelDataBundleNames`,
          chosenData,
          chosenData,
          "withscores"
        );
        console.log(dataPlanName);
        let {
          bundleNames: extractedDataPlanName,
          bundlePrices: extractedDataPlanPrice
        } = extractBundleNameAndPrice(dataPlanName);
        console.log(
          dataPlanCode,
          extractedDataPlanName,
          extractedDataPlanPrice
        );
        await redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "dataPlanCode",
          dataPlanCode[0],
          "dataPlanName",
          extractedDataPlanName[0],
          "dataPlanPrice",
          extractedDataPlanPrice[0]
        );
        resolve();
      });
  });
}

function processDataPurchase(
  sessionId,
  phoneNumber,
  numberToCredit,
  dataPlanCode,
  dataPlanName,
  walletPin
) {
  return new Promise((resolve, reject) => {
    let payload = {
      offeringGroup: "core",
      offeringName: "databundle",
      method: "felawallet",
      auth: {
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        passkey: `${walletPin}`
      },
      params: {
        account_id: `${numberToCredit}`,
        bundle_code: `${dataPlanCode}`,
        network: "Airtel",
        passkey: `${walletPin}`
      },
      user: {
        sessionId: `${sessionId}`,
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        sourceId: `${phoneNumber}`,
        phoneNumber: `${phoneNumber}`
      }
    };

    console.log(payload);
    axios
      .post(`${FelaMarketPlace.BASE_URL}/payment/request`, payload, {
        headers: felaHeader
      })
      .then(response => {
        console.log(JSON.stringify(response.data, null, 2));
        // console.log(response)
        resolve(
          `CON Dear Customer your line ${numberToCredit} has been credited with ${dataPlanName} of Data\n\n0 Menu`
        );
      })
      .catch(error => {
        console.log("error");
        console.log(JSON.stringify(error.response.data, null, 2));
        if (error.response.data.code === 422) {
          resolve(
            `CON Transaction Failed!\nInsufficient user balance\n\n0 Menu`
          );
        } else {
          resolve(`CON Transaction Failed!\n\n0 Menu`);
        }
      });
  });
}

function formatNumber(num) {
  if (typeof num === "string") {
    num = parseInt(num, 10);
    console.log(num);
  }
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
}
module.exports = {
  processData
};
