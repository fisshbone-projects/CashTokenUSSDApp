const { redisClient } = require("../redisConnectConfig");
const { FelaMarketPlace, App } = require("../index");
const moment = require("moment");
const {
  APP_PREFIX_REDIS,
  testPhoneNumber,
  formatNumber,
  MYBANKUSSD_BANK_CODES,
  MYBANKUSSD_BASE_CODE,
  MYBANKUSSD_SERVICE_CODES
} = require("../utils");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
const NAIRASIGN = "N";
const API_DATA_EXPIRE_TIME = parseInt(App.REDIS_API_DATA_EXPIRE);

async function processData(text, phoneNumber, sessionId) {
  return new Promise(async resolve => {
    console.log("Starting Data Purchase Process");
    let response = "";
    let brokenDownText = text.split("*");
    response = await dataFlow(brokenDownText, phoneNumber, sessionId);
    resolve(response);
  });
}

async function dataFlow(brokenDownText, phoneNumber, sessionId) {
  return new Promise(async resolve => {
    let response = "";

    if (brokenDownText.length === 1) {
      await redisClient.incrAsync(
        `${APP_PREFIX_REDIS}:reports:count:topMenu_Data:${moment().format(
          "DMMYYYY"
        )}`
      );
      response = await getDataProviders();
      resolve(response);
    } else if (brokenDownText.length >= 2) {
      if (brokenDownText.length === 2) {
        let dataCode = parseInt(brokenDownText[1]);
        let totalDataProviders = await redisClient.zcardAsync(
          `${APP_PREFIX_REDIS}:DataProvidersCodes`
        );
        if (dataCode <= totalDataProviders) {
          let [dataHandler] = await redisClient.zrangebyscoreAsync(
            `${APP_PREFIX_REDIS}:DataProvidersCodes`,
            dataCode,
            dataCode
          );
          let [dataProviderName] = await redisClient.zrangebyscoreAsync(
            `${APP_PREFIX_REDIS}:DataProvidersNames`,
            dataCode,
            dataCode
          );
          await redisClient.hmsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "dataCode",
            dataCode,
            "dataHandler",
            dataHandler,
            "chosenDataProvider",
            dataProviderName
          );
        } else {
          await redisClient.hmsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "dataCode",
            dataCode,
            "dataHandler",
            "nonExistentProvider"
          );
        }
      }

      let { dataHandler } = await redisClient.hgetallAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`
      );

      switch (dataHandler) {
        case "MTN":
          response = await handleMTN(
            brokenDownText,
            phoneNumber,
            sessionId,
            dataHandler
          );
          break;
        case "Airtel":
          response = await handleAirtel(brokenDownText, phoneNumber, sessionId);
          break;
        case "Etisalat":
          response = await handleEtisalat(
            brokenDownText,
            phoneNumber,
            sessionId
          );
          break;
        case "Smile":
          response = await handleSmile(brokenDownText, phoneNumber, sessionId);
          break;
        case "Spectranet":
          response = await handleSpectranet(
            brokenDownText,
            phoneNumber,
            sessionId
          );
          break;
        default:
          response =
            "CON Invalid response inputed\n\nEnter 0 Back to home menu";
          break;
      }

      resolve(response);
    } else {
      response = "CON Invalid response inputed\n\nEnter 0 Back to home menu";
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
        response += `0 Main Menu`;

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

async function handleMTN(brokenDownText, phoneNumber, sessionId, dataHandler) {
  return new Promise(async resolve => {
    let response = "";
    if (brokenDownText.length === 2) {
      response = await displayBundles(dataHandler, 0, 6);
      resolve(response);
    } else if (brokenDownText.length === 3 && brokenDownText[2] === "8") {
      response = await displayBundles(dataHandler, 7, 13);
      resolve(response);
    } else if (
      brokenDownText.length === 3 &&
      parseInt(brokenDownText[2]) <= 7 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "selectBundle"
    ) {
      let bundleChosen = parseInt(brokenDownText[2]);
      response = await saveUserBundleData(
        sessionId,
        bundleChosen - 1,
        dataHandler
      );
      resolve(response);
    } else if (brokenDownText.length === 4 && brokenDownText[3] === "8") {
      response = await displayBundles(dataHandler, 14, -1);
      resolve(response);
    } else if (
      brokenDownText.length === 4 &&
      parseInt(brokenDownText[3]) <= 7 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "selectBundle"
    ) {
      let bundleChosen = parseInt(brokenDownText[3]);
      response = await saveUserBundleData(
        sessionId,
        bundleChosen + 6,
        dataHandler
      );
      resolve(response);
    } else if (
      brokenDownText.length === 5 &&
      parseInt(brokenDownText[4]) <= 9 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "selectBundle"
    ) {
      let bundleChosen = parseInt(brokenDownText[4]);
      response = await saveUserBundleData(
        sessionId,
        bundleChosen + 13,
        dataHandler
      );
      resolve(response);
    } else if (
      (brokenDownText.length === 4 ||
        brokenDownText.length === 5 ||
        brokenDownText.length === 6) &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "savedBundle"
    ) {
      let recipentNumber = "";
      if (brokenDownText.length === 4) {
        recipentNumber = brokenDownText[3];
      } else if (brokenDownText.length === 5) {
        recipentNumber = brokenDownText[4];
      } else if (brokenDownText.length === 6) {
        recipentNumber = brokenDownText[5];
      }

      if (testPhoneNumber(recipentNumber)) {
        console.log("Number is valid");
        await redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "recipentNumber",
          `${recipentNumber}`,
          "userState",
          "gotRecipent"
        );
        response = `CON Select Payment Method:\n1 My CashToken Wallet\n2 MyBankUSSD`;
        resolve(response);
      } else {
        console.log("Number is invalid");
        response = `CON Error! Inputted number is not a valid phone number\n\nEnter 0 to start over`;
        resolve(response);
      }
    } else if (
      (brokenDownText.length === 5 ||
        brokenDownText.length === 6 ||
        brokenDownText.length === 7) &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "gotRecipent"
    ) {
      let paymentMethod = "";
      if (brokenDownText.length === 5) {
        paymentMethod = brokenDownText[4];
      } else if (brokenDownText.length === 6) {
        paymentMethod = brokenDownText[5];
      } else if (brokenDownText.length === 7) {
        paymentMethod = brokenDownText[6];
      }

      if (paymentMethod === "1" || paymentMethod === "2") {
        if (paymentMethod === "1") {
          await redisClient.hmsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "paymentMethod",
            "felawallet",
            "userState",
            "gotPaymentMethod"
          );

          response = "CON Enter your wallet PIN:";
          resolve(response);
        } else {
          await redisClient.hmsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "paymentMethod",
            "coralpay",
            "userState",
            "gotPaymentMethod"
          );
          response = displayMyBankUSSDBanks();
          resolve(response);
        }
      } else {
        response =
          "CON Error!\nSelect a valid payment method\n\nEnter 0 to start over";
        resolve(response);
      }
    } else if (
      (brokenDownText.length === 6 ||
        brokenDownText.length === 7 ||
        brokenDownText.length === 8) &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "gotPaymentMethod"
    ) {
      let paymentDetail = "";
      let paymentMethod = await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      );

      if (brokenDownText.length === 6) {
        paymentDetail = brokenDownText[5];
      } else if (brokenDownText.length === 7) {
        paymentDetail = brokenDownText[6];
      } else if (brokenDownText.length === 8) {
        paymentDetail = brokenDownText[7];
      }

      if (paymentMethod === "felawallet") {
        if (/^[0-9]*$/.test(paymentDetail)) {
          await redisClient.hmsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "walletPin",
            `${paymentDetail}`,
            "userState",
            "makePayment"
          );
          response = await displayPurchaseSummary(paymentMethod, sessionId);
          resolve(response);
        } else {
          console.log("PIN is invalid");
          response = `CON Error!\nPIN can only be numbers\n\nEnter 0 to start over`;
          resolve(response);
        }
      } else if (paymentMethod === "coralpay") {
        let chosenUSSDBank = parseInt(paymentDetail);

        if (chosenUSSDBank <= Object.values(MYBANKUSSD_BANK_CODES).length) {
          let chosenUSSDBankName = Object.keys(MYBANKUSSD_BANK_CODES)[
            chosenUSSDBank - 1
          ];
          let chosenUSSDBankCode = Object.values(MYBANKUSSD_BANK_CODES)[
            chosenUSSDBank - 1
          ];
          await redisClient.hmsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "chosenUSSDBankName",
            chosenUSSDBankName,
            "chosenUSSDBankCode",
            chosenUSSDBankCode,
            "userState",
            "makePayment"
          );

          response = await displayPurchaseSummary(paymentMethod, sessionId);
          resolve(response);
        }
      }
    } else if (
      (brokenDownText.length === 7 ||
        brokenDownText.length === 8 ||
        brokenDownText.length === 9) &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "makePayment"
    ) {
      let paymentMethod = await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      );
      let confirmation = "";

      if (brokenDownText.length === 7) {
        confirmation = brokenDownText[6];
      } else if (brokenDownText.length === 8) {
        confirmation = brokenDownText[7];
      } else if (brokenDownText.length === 9) {
        confirmation = brokenDownText[8];
      }

      if (confirmation === "1") {
        response = await makePayment(paymentMethod, sessionId, phoneNumber);
        resolve(response);
      } else if (confirmation === "2") {
        response = `CON Transaction Cancelled!\n\n0 Menu`;
        resolve(response);
      }
    } else {
      response = "CON Invalid response inputed\n\nEnter 0 Back to home menu";
      resolve(response);
    }
  });

  function displayBundles(codeName, start, end) {
    return new Promise(resolve => {
      redisClient
        .existsAsync(`${APP_PREFIX_REDIS}:${codeName}BundleNames`)
        .then(async resp => {
          if (resp === 0) {
            let bundles = await fetchDataBundle(codeName);
            await storeBundle(codeName, bundles);
          }

          let providers = await redisClient.zrangeAsync(
            `${APP_PREFIX_REDIS}:${codeName}BundleNames`,
            start,
            end
          );

          console.log(providers);
          response = `CON Select Data Bundle:\n`;
          let index = 0;
          providers.forEach(value => {
            response += `${++index} ${value}\n`;
          });

          let rank = await redisClient.zrankAsync(
            `${APP_PREFIX_REDIS}:${codeName}BundleNames`,
            `${providers[providers.length - 1]}`
          );

          let bundleSize = await redisClient.zcardAsync(
            `${APP_PREFIX_REDIS}:${codeName}BundleNames`
          );

          console.log(rank, bundleSize);
          if (rank + 1 != bundleSize) {
            response += `${++index} Next`;
          }

          await redisClient.hsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "userState",
            "selectBundle"
          );
          resolve(response);
        });
    });
  }

  function storeBundle(codeName, bundles) {
    return new Promise(async resolve => {
      for (let bundle of Object.values(bundles)) {
        let refinedName = refineName(bundle.title);
        await redisClient.zaddAsync(
          `${APP_PREFIX_REDIS}:${codeName}BundleNames`,
          bundle.price,
          refinedName
        );
        await redisClient.zaddAsync(
          `${APP_PREFIX_REDIS}:${codeName}BundleCodes`,
          bundle.price,
          bundle.code
        );
      }
      resolve();
    });
  }

  function refineName(name) {
    let refinedName = "";
    name = name.replace(/\s/g, "");
    refinedName = name.replace("-", "/");
    return refinedName;
  }

  function saveUserBundleData(sessionId, chosenBundle, codeName) {
    return new Promise(async resolve => {
      let [chosenBundleName, dataPrice] = await redisClient.zrangeAsync(
        `${APP_PREFIX_REDIS}:${codeName}BundleNames`,
        chosenBundle,
        chosenBundle,
        "withscores"
      );

      let [chosenBundleCode] = await redisClient.zrangeAsync(
        `${APP_PREFIX_REDIS}:${codeName}BundleCodes`,
        chosenBundle,
        chosenBundle
      );

      await redisClient.hmset(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "chosenBundleName",
        chosenBundleName,
        "chosenBundleCode",
        chosenBundleCode,
        "dataPrice",
        dataPrice,
        "userState",
        "savedBundle"
      );

      console.log(chosenBundleCode, chosenBundleName);

      resolve(`CON Enter Recipient's Phone Number:`);
    });
  }
}

async function handleAirtel(brokenDownText, phoneNumber, sessionId) {
  return new Promise(async resolve => {
    resolve("CON SELECT DATA BUNDLE");
  });
}

async function handleEtisalat(brokenDownText, phoneNumber, sessionId) {
  return new Promise(async resolve => {
    resolve("CON SELECT DATA BUNDLE");
  });
}

async function handleSmile(brokenDownText, phoneNumber, sessionId) {
  return new Promise(async resolve => {
    resolve("CON SELECT DATA BUNDLE");
  });
}

async function handleSpectranet(brokenDownText, phoneNumber, sessionId) {
  return new Promise(async resolve => {
    resolve("CON SELECT DATA BUNDLE");
  });
}

async function fetchDataBundle(code) {
  return new Promise(resolve => {
    axios
      .get(
        `${FelaMarketPlace.BASE_URL}/list/dataBundles?provider_code=${code}`,
        {
          headers: {
            Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}`
          }
        }
      )
      .then(async response => {
        resolve(response.data.data);
      });
  });
}

function displayMyBankUSSDBanks() {
  let response = "CON Select your Bank:\n";
  let bankNames = Object.keys(MYBANKUSSD_BANK_CODES);

  for (let [index, bank] of bankNames.entries()) {
    response += `${++index} ${bank}\n`;
  }
  return response;
}

function displayPurchaseSummary(paymentMethod, sessionId) {
  return new Promise(async resolve => {
    if (paymentMethod === "felawallet") {
      let {
        recipentNumber,
        chosenDataProvider,
        dataPrice,
        chosenBundleName
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      response = `CON Confirm DataPlan Purchase:\nRecipient's Number: ${recipentNumber}\nNetwork: ${chosenDataProvider}\nDataPlan: ${chosenBundleName}\nPrice: ${formatNumber(
        dataPrice
      )}\nPayMethod: Wallet\n\n1 Confirm\n2 Cancel`;
      resolve(response);
    } else if (paymentMethod === "coralpay") {
      let {
        recipentNumber,
        chosenDataProvider,
        dataPrice,
        chosenBundleName,
        chosenUSSDBankName
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      response = `CON Confirm DataPlan Purchase:\nRecipient's Number: ${recipentNumber}\nNetwork: ${chosenDataProvider}\nDataPlan: ${chosenBundleName}\nPrice: ${formatNumber(
        dataPrice
      )}\nPayMethod: ${
        chosenUSSDBankName.includes("bank") ||
        chosenUSSDBankName == "GTB" ||
        chosenUSSDBankName == "FBN" ||
        chosenUSSDBankName == "UBA"
          ? chosenUSSDBankName
          : `${chosenUSSDBankName} Bank`
      }\n\n1 Confirm\n2 Cancel`;
      resolve(response);
    }
  });
}

function makePayment(paymentMethod, sessionId, phoneNumber) {
  return new Promise(async resolve => {
    let response = "";
    if (paymentMethod === "felawallet") {
      let {
        dataHandler,
        recipentNumber,
        chosenBundleCode,
        chosenBundleName,
        walletPin
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      response = await processDataPurchase(
        sessionId,
        phoneNumber,
        recipentNumber,
        dataHandler,
        chosenBundleCode,
        chosenBundleName,
        paymentMethod,
        walletPin
      );
    } else if (paymentMethod === "coralpay") {
      let {
        dataHandler,
        recipentNumber,
        chosenBundleCode,
        chosenBundleName,
        chosenUSSDBankCode
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      response = await processDataPurchase(
        sessionId,
        phoneNumber,
        recipentNumber,
        dataHandler,
        chosenBundleCode,
        chosenBundleName,
        paymentMethod,
        undefined,
        chosenUSSDBankCode
      );
    }

    resolve(response);
  });
}

function processDataPurchase(
  sessionId,
  phoneNumber,
  recipentNumber,
  providerCode,
  dataPlanCode,
  dataPlanName,
  paymentMethod,
  walletPin = "",
  chosenUSSDBankCode = ""
) {
  return new Promise(async (resolve, reject) => {
    let payload = {
      offeringGroup: "core",
      offeringName: "databundle",
      method: paymentMethod,
      auth: {
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        passkey: `${walletPin}`
      },
      params: {
        account_id: `${recipentNumber}`,
        bundle_code: `${dataPlanCode}`,
        network: `${providerCode}`
      },
      user: {
        sessionId: `${sessionId}`,
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        sourceId: `${phoneNumber}`,
        phoneNumber: `${phoneNumber}`
      }
    };

    console.log(payload);

    try {
      let response = await axios.post(
        `${FelaMarketPlace.BASE_URL}/payment/request`,
        payload,
        {
          headers: felaHeader
        }
      );

      switch (paymentMethod) {
        case "felawallet":
          console.log(JSON.stringify(response.data, null, 2));
          // console.log(response)
          await redisClient.incrAsync(
            `${APP_PREFIX_REDIS}:reports:count:purchases_DataWithWallet:${moment().format(
              "DMMYYYY"
            )}`
          );
          resolve(
            `CON Dear Customer your line ${recipentNumber} has been credited with ${dataPlanName} of Data\n\n0 Menu`
          );
          break;

        case "coralpay":
          console.log("Getting response from coral pay");
          await redisClient.incrAsync(
            `${APP_PREFIX_REDIS}:reports:count:purchases_DataWithMyBankUSSD:${moment().format(
              "DMMYYYY"
            )}`
          );
          let paymentToken = response.data.data.paymentToken;
          // console.log(response.data);

          //   resolve(
          //     `CON Ur Bank is *${chosenUSSDBankCode}#\nNever 4GET *000*\nTrans Code is ${paymentToken}\nRem last 4 Digits!\n\nDial2Pay *${chosenUSSDBankCode}*000*${paymentToken}#\nExpires in 5mins\n\nCashback\nWin N5k-100m\n\n0 Menu`
          //   );
          resolve(
            `CON To complete your transaction, dial *${chosenUSSDBankCode}*000*${paymentToken}#\nPlease note that this USSD String will expire in the next 5 minutes.\n\n 0 Menu`
          );
      }
    } catch (error) {
      console.log("error");
      console.log(JSON.stringify(error.response.data, null, 2));
      if (!!error.response) {
        resolve(
          `CON Transaction Failed!\n${error.response.data.message}\n\nEnter 0 Back to home menu`
        );
      } else {
        resolve(`CON Transaction Failed!\n\nEnter 0 Back to home menu`);
      }
    }
  });
}

module.exports = { processData };
