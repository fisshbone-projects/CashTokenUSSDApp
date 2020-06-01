const { redisClient } = require("$config/redisConnectConfig");
const { FelaMarketPlace, App } = require("$config");
const {
  APP_PREFIX_REDIS,
  testPhoneNumber,
  formatNumber,
  MYBANKUSSD_BANK_CODES,
  expireReportsInRedis,
} = require("$utils");
const moment = require("moment");
const axios = require("axios");
const NAIRASIGN = "N";
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
const API_DATA_EXPIRE_TIME = parseInt(App.REDIS_API_DATA_EXPIRE);

async function regularBuy(phoneNumber, text, sessionId) {
  return new Promise(async (resolve) => {
    let response = "";
    let brokenDownText = text.split("*");
    let textLength = brokenDownText.length;

    if (textLength === 2) {
      await redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "data_purchase_method",
        "regularBuy"
      );
      response = await getDataProviders();
    } else if (textLength >= 3) {
      if (textLength === 3) {
        let dataCode = parseInt(brokenDownText[textLength - 1]);
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
          response = await handleAirtel(
            brokenDownText,
            phoneNumber,
            sessionId,
            dataHandler
          );
          break;
        case "Etisalat":
          response = await handleEtisalat(
            brokenDownText,
            phoneNumber,
            sessionId,
            dataHandler
          );
          break;
        case "Smile":
          response = await handleSmile(
            brokenDownText,
            phoneNumber,
            sessionId,
            dataHandler
          );
          break;
        case "Spectranet":
          response = await handleSpectranet(
            brokenDownText,
            phoneNumber,
            sessionId,
            dataHandler
          );
          break;
        default:
          response =
            "CON Invalid response entered\n\nEnter 0 Back to home menu";
          break;
      }
    } else {
      response = "CON Invalid response entered\n\nEnter 0 Back to home menu";
    }
    resolve(response);
  });
}

function getDataProviders() {
  return new Promise((resolve) => {
    redisClient
      .existsAsync(`${APP_PREFIX_REDIS}:DataProvidersNames`)
      .then(async (resp) => {
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
        // response += `0 Main menu`;

        resolve(response);
      });
  });
}

async function fetchDataProviders() {
  return new Promise((resolve) => {
    axios
      .get(`${FelaMarketPlace.BASE_URL}/list/dataProviders`, {
        headers: {
          Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER} `,
        },
      })
      .then(async (response) => {
        let dataProvidersArray = Object.values(response.data.data);

        for (let [index, provider] of dataProvidersArray.entries()) {
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
  return new Promise(async (resolve) => {
    let response = "";
    let textLength = brokenDownText.length;
    if (textLength === 3) {
      response = await displayBundles(dataHandler, 0, 6);
    } else if (textLength === 4 && brokenDownText[textLength - 1] === "8") {
      response = await displayBundles(dataHandler, 7, 13);
    } else if (
      textLength === 4 &&
      parseInt(brokenDownText[textLength - 1]) <= 7 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "selectBundle"
    ) {
      let bundleChosen = parseInt(brokenDownText[textLength - 1]);
      response = await saveUserBundleData(
        sessionId,
        bundleChosen - 1,
        dataHandler
      );
    } else if (textLength === 5 && brokenDownText[textLength - 1] === "8") {
      response = await displayBundles(dataHandler, 14, 20);
    } else if (
      textLength === 5 &&
      parseInt(brokenDownText[textLength - 1]) <= 7 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "selectBundle"
    ) {
      let bundleChosen = parseInt(brokenDownText[textLength - 1]);
      response = await saveUserBundleData(
        sessionId,
        bundleChosen + 6,
        dataHandler
      );
    } else if (textLength === 6 && brokenDownText[textLength - 1] === "8") {
      response = await displayBundles(dataHandler, 21, -1);
    } else if (
      textLength === 6 &&
      parseInt(brokenDownText[textLength - 1]) <= 7 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "selectBundle"
    ) {
      let bundleChosen = parseInt(brokenDownText[textLength - 1]);
      response = await saveUserBundleData(
        sessionId,
        bundleChosen + 13,
        dataHandler
      );
    } else if (
      textLength === 7 &&
      parseInt(brokenDownText[textLength - 1]) <= 7 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "selectBundle"
    ) {
      let bundleChosen = parseInt(brokenDownText[textLength - 1]);
      response = await saveUserBundleData(
        sessionId,
        bundleChosen + 20,
        dataHandler
      );
    } else if (
      (textLength === 5 ||
        textLength === 6 ||
        textLength === 7 ||
        textLength === 8) &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "savedBundle"
    ) {
      let recipentNumber = "";
      recipentNumber = brokenDownText[textLength - 1];

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
      } else {
        console.log("Number is invalid");
        response = `CON Error! Inputted number is not a valid phone number\n\nEnter 0 Back to home menu`;
      }
    } else if (
      (textLength === 6 ||
        textLength === 7 ||
        textLength === 8 ||
        textLength === 9) &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "gotRecipent"
    ) {
      let paymentMethod = brokenDownText[textLength - 1];

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
        } else {
          await redisClient.hmsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "paymentMethod",
            "coralpay",
            "userState",
            "gotPaymentMethod"
          );
          response = displayMyBankUSSDBanks();
        }
      } else {
        response =
          "CON Error!\nSelect a valid payment method\n\nEnter 0 Back to home menu";
      }
    } else if (
      (textLength === 7 ||
        textLength === 8 ||
        textLength === 9 ||
        textLength === 10) &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "gotPaymentMethod"
    ) {
      let paymentDetail = brokenDownText[textLength - 1];
      let paymentMethod = await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      );

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
        } else {
          console.log("PIN is invalid");
          response = `CON Error!\nPIN can only be numbers\n\nEnter 0 Back to home menu`;
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
        }
      }
    } else if (
      (textLength === 8 ||
        textLength === 9 ||
        textLength === 10 ||
        textLength === 11) &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "makePayment"
    ) {
      let paymentMethod = await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      );
      let confirmation = brokenDownText[textLength - 1];

      if (confirmation === "1") {
        response = await makePayment(paymentMethod, sessionId, phoneNumber);
      } else if (confirmation === "2") {
        response = `CON Transaction Cancelled!\n\n0 Menu`;
      }
    } else {
      response = "CON Invalid response entered\n\nEnter 0 Back to home menu";
    }

    resolve(response);
  });

  function displayBundles(codeName, start, end) {
    return new Promise((resolve) => {
      redisClient
        .existsAsync(`${APP_PREFIX_REDIS}:${codeName}BundleNames`)
        .then(async (resp) => {
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
          let response = `CON Select Data Bundle:\n`;
          let index = 0;
          providers.forEach((value) => {
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
    return new Promise(async (resolve) => {
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
      redisClient.expire(
        `${APP_PREFIX_REDIS}:${codeName}BundleNames`,
        API_DATA_EXPIRE_TIME
      );
      redisClient.expire(
        `${APP_PREFIX_REDIS}:${codeName}BundleCodes`,
        API_DATA_EXPIRE_TIME
      );
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
    return new Promise(async (resolve) => {
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

async function handleAirtel(
  brokenDownText,
  phoneNumber,
  sessionId,
  dataHandler
) {
  return new Promise(async (resolve) => {
    let response = "";
    let textLength = brokenDownText.length;
    if (textLength === 3) {
      response = await displayBundles(dataHandler, 0, 7);
    } else if (textLength === 4 && brokenDownText[textLength - 1] === "9") {
      response = await displayBundles(dataHandler, 8, -1);
    } else if (
      textLength === 4 &&
      parseInt(brokenDownText[textLength - 1]) <= 8 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "selectBundle"
    ) {
      let bundleChosen = parseInt(brokenDownText[textLength - 1]);
      response = await saveUserBundleData(
        sessionId,
        bundleChosen - 1,
        dataHandler
      );
    } else if (
      textLength === 5 &&
      parseInt(brokenDownText[textLength - 1]) <= 8 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "selectBundle"
    ) {
      let bundleChosen = parseInt(brokenDownText[textLength - 1]);
      response = await saveUserBundleData(
        sessionId,
        bundleChosen + 7,
        dataHandler
      );
    } else if (
      (textLength === 5 || textLength === 6) &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "savedBundle"
    ) {
      let recipentNumber = brokenDownText[textLength - 1];

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
      } else {
        console.log("Number is invalid");
        response = `CON Error! Inputted number is not a valid phone number\n\nEnter 0 Back to home menu`;
      }
    } else if (
      (textLength === 6 || textLength === 7) &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "gotRecipent"
    ) {
      let paymentMethod = brokenDownText[textLength - 1];

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
        } else {
          await redisClient.hmsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "paymentMethod",
            "coralpay",
            "userState",
            "gotPaymentMethod"
          );
          response = displayMyBankUSSDBanks();
        }
      } else {
        response =
          "CON Error!\nSelect a valid payment method\n\nEnter 0 Back to home menu";
      }
    } else if (
      (textLength === 7 || textLength === 8) &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "gotPaymentMethod"
    ) {
      let paymentDetail = brokenDownText[textLength - 1];
      let paymentMethod = await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      );

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
        } else {
          console.log("PIN is invalid");
          response = `CON Error!\nPIN can only be numbers\n\nEnter 0 Back to home menu`;
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
        }
      }
    } else if (
      (textLength === 8 || textLength === 9) &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "makePayment"
    ) {
      let paymentMethod = await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      );
      let confirmation = brokenDownText[textLength - 1];

      if (confirmation === "1") {
        response = await makePayment(paymentMethod, sessionId, phoneNumber);
      } else if (confirmation === "2") {
        response = `CON Transaction Cancelled!\n\n0 Menu`;
      }
    } else {
      response = "CON Invalid response entered\n\nEnter 0 Back to home menu";
    }
    resolve(response);
  });

  function displayBundles(codeName, start, end) {
    return new Promise((resolve) => {
      redisClient
        .existsAsync(`${APP_PREFIX_REDIS}:${codeName}BundleNames`)
        .then(async (resp) => {
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
          providers.forEach((value) => {
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
    return new Promise(async (resolve) => {
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
      redisClient.expire(
        `${APP_PREFIX_REDIS}:${codeName}BundleNames`,
        API_DATA_EXPIRE_TIME
      );
      redisClient.expire(
        `${APP_PREFIX_REDIS}:${codeName}BundleCodes`,
        API_DATA_EXPIRE_TIME
      );
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
    return new Promise(async (resolve) => {
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

async function handleEtisalat(
  brokenDownText,
  phoneNumber,
  sessionId,
  dataHandler
) {
  return new Promise(async (resolve) => {
    let response = "";
    let textLength = brokenDownText.length;
    if (textLength === 3) {
      response = await displayBundles(dataHandler, 0, 7);
    } else if (textLength === 4 && brokenDownText[textLength - 1] === "9") {
      response = await displayBundles(dataHandler, 8, -1);
    } else if (
      textLength === 4 &&
      parseInt(brokenDownText[textLength - 1]) <= 8 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "selectBundle"
    ) {
      let bundleChosen = parseInt(brokenDownText[textLength - 1]);
      response = await saveUserBundleData(
        sessionId,
        bundleChosen - 1,
        dataHandler
      );
    } else if (
      textLength === 5 &&
      parseInt(brokenDownText[textLength - 1]) <= 8 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "selectBundle"
    ) {
      let bundleChosen = parseInt(brokenDownText[textLength - 1]);
      response = await saveUserBundleData(
        sessionId,
        bundleChosen + 7,
        dataHandler
      );
    } else if (
      (textLength === 5 || textLength === 6) &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "savedBundle"
    ) {
      let recipentNumber = brokenDownText[textLength - 1];

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
      } else {
        console.log("Number is invalid");
        response = `CON Error! Inputted number is not a valid phone number\n\nEnter 0 Back to home menu`;
      }
    } else if (
      (textLength === 6 || textLength === 7) &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "gotRecipent"
    ) {
      let paymentMethod = brokenDownText[textLength - 1];

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
        } else {
          await redisClient.hmsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "paymentMethod",
            "coralpay",
            "userState",
            "gotPaymentMethod"
          );
          response = displayMyBankUSSDBanks();
        }
      } else {
        response =
          "CON Error!\nSelect a valid payment method\n\nEnter 0 Back to home menu";
      }
    } else if (
      (textLength === 7 || textLength === 8) &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "gotPaymentMethod"
    ) {
      let paymentDetail = brokenDownText[textLength - 1];
      let paymentMethod = await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      );

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
        } else {
          console.log("PIN is invalid");
          response = `CON Error!\nPIN can only be numbers\n\nEnter 0 Back to home menu`;
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
        }
      }
    } else if (
      (textLength === 8 || textLength === 9) &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "makePayment"
    ) {
      let paymentMethod = await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      );
      let confirmation = brokenDownText[textLength - 1];

      if (confirmation === "1") {
        response = await makePayment(paymentMethod, sessionId, phoneNumber);
      } else if (confirmation === "2") {
        response = `CON Transaction Cancelled!\n\n0 Menu`;
      }
    } else {
      response = "CON Invalid response entered\n\nEnter 0 Back to home menu";
    }

    resolve(response);
  });

  function displayBundles(codeName, start, end) {
    return new Promise((resolve) => {
      redisClient
        .existsAsync(`${APP_PREFIX_REDIS}:${codeName}BundleNames`)
        .then(async (resp) => {
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
          providers.forEach((value) => {
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
    return new Promise(async (resolve) => {
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
      redisClient.expire(
        `${APP_PREFIX_REDIS}:${codeName}BundleNames`,
        API_DATA_EXPIRE_TIME
      );
      redisClient.expire(
        `${APP_PREFIX_REDIS}:${codeName}BundleCodes`,
        API_DATA_EXPIRE_TIME
      );
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
    return new Promise(async (resolve) => {
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

async function handleSmile(
  brokenDownText,
  phoneNumber,
  sessionId,
  dataHandler
) {
  return new Promise(async (resolve) => {
    let response = "";
    let textLength = brokenDownText.length;
    if (textLength === 3) {
      response = await displayBundles(dataHandler, 0, 5);
    } else if (textLength === 4 && brokenDownText[textLength - 1] === "7") {
      response = await displayBundles(dataHandler, 6, 11);
    } else if (textLength === 5 && brokenDownText[textLength - 1] === "7") {
      response = await displayBundles(dataHandler, 12, 17);
    } else if (textLength === 6 && brokenDownText[textLength - 1] === "7") {
      response = await displayBundles(dataHandler, 18, 23);
    } else if (textLength === 7 && brokenDownText[textLength - 1] === "7") {
      response = await displayBundles(dataHandler, 24, 29);
    } else if (textLength === 8 && brokenDownText[textLength - 1] === "7") {
      response = await displayBundles(dataHandler, 30, 35);
    } else if (textLength === 9 && brokenDownText[textLength - 1] === "7") {
      response = await displayBundles(dataHandler, 36, 41);
    } else if (textLength === 10 && brokenDownText[textLength - 1] === "7") {
      response = await displayBundles(dataHandler, 42, 47);
    } else if (textLength === 11 && brokenDownText[textLength - 1] === "7") {
      response = await displayBundles(dataHandler, 48, 53);
    } else if (textLength === 12 && brokenDownText[textLength - 1] === "7") {
      response = await displayBundles(dataHandler, 54, 59);
    } else if (textLength === 13 && brokenDownText[textLength - 1] === "7") {
      response = await displayBundles(dataHandler, 60, 65);
    } else if (textLength === 14 && brokenDownText[textLength - 1] === "7") {
      response = await displayBundles(dataHandler, 66, 71);
    } else if (textLength === 15 && brokenDownText[textLength - 1] === "7") {
      response = await displayBundles(dataHandler, 72, 77);
    } else if (textLength === 16 && brokenDownText[textLength - 1] === "7") {
      response = await displayBundles(dataHandler, 78, 83);
    } else if (textLength === 17 && brokenDownText[textLength - 1] === "7") {
      response = await displayBundles(dataHandler, 84, 89);
    } else if (textLength === 18 && brokenDownText[textLength - 1] === "7") {
      response = await displayBundles(dataHandler, 90, 95);
    } else if (textLength === 19 && brokenDownText[textLength - 1] === "7") {
      response = await displayBundles(dataHandler, 96, 101);
    } else if (textLength === 20 && brokenDownText[textLength - 1] === "7") {
      response = await displayBundles(dataHandler, 102, 107);
    } else if (textLength === 21 && brokenDownText[textLength - 1] === "7") {
      response = await displayBundles(dataHandler, 108, -1);
    } else if (
      (([
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
      ].includes(textLength) &&
        Number(brokenDownText[textLength - 1]) <= 6) ||
        (textLength === 22 && Number(brokenDownText[textLength - 1] <= 4))) &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "selectBundle"
    ) {
      let bundleChosen;
      let selectedBundle;
      switch (textLength) {
        case 4:
          bundleChosen = parseInt(brokenDownText[textLength - 1]);
          selectedBundle = bundleChosen - 1;
          break;
        case 5:
          bundleChosen = parseInt(brokenDownText[textLength - 1]);
          selectedBundle = bundleChosen + 5;
          break;
        case 6:
          bundleChosen = parseInt(brokenDownText[textLength - 1]);
          selectedBundle = bundleChosen + 11;
          break;
        case 7:
          bundleChosen = parseInt(brokenDownText[textLength - 1]);
          selectedBundle = bundleChosen + 17;
          break;
        case 8:
          bundleChosen = parseInt(brokenDownText[textLength - 1]);
          selectedBundle = bundleChosen + 23;
          break;
        case 9:
          bundleChosen = parseInt(brokenDownText[textLength - 1]);
          selectedBundle = bundleChosen + 29;
          break;
        case 10:
          bundleChosen = parseInt(brokenDownText[textLength - 1]);
          selectedBundle = bundleChosen + 35;
          break;
        case 11:
          bundleChosen = parseInt(brokenDownText[textLength - 1]);
          selectedBundle = bundleChosen + 41;
          break;
        case 12:
          bundleChosen = parseInt(brokenDownText[textLength - 1]);
          selectedBundle = bundleChosen + 47;
          break;
        case 13:
          bundleChosen = parseInt(brokenDownText[textLength - 1]);
          selectedBundle = bundleChosen + 53;
          break;
        case 14:
          bundleChosen = parseInt(brokenDownText[textLength - 1]);
          selectedBundle = bundleChosen + 59;
          break;
        case 15:
          bundleChosen = parseInt(brokenDownText[textLength - 1]);
          selectedBundle = bundleChosen + 65;
          break;
        case 16:
          bundleChosen = parseInt(brokenDownText[textLength - 1]);
          selectedBundle = bundleChosen + 71;
          break;
        case 17:
          bundleChosen = parseInt(brokenDownText[textLength - 1]);
          selectedBundle = bundleChosen + 77;
          break;
        case 18:
          bundleChosen = parseInt(brokenDownText[textLength - 1]);
          selectedBundle = bundleChosen + 83;
          break;
        case 19:
          bundleChosen = parseInt(brokenDownText[textLength - 1]);
          selectedBundle = bundleChosen + 89;
          break;
        case 20:
          bundleChosen = parseInt(brokenDownText[textLength - 1]);
          selectedBundle = bundleChosen + 95;
          break;
        case 21:
          bundleChosen = parseInt(brokenDownText[textLength - 1]);
          selectedBundle = bundleChosen + 101;
          break;
        case 22:
          bundleChosen = parseInt(brokenDownText[textLength - 1]);
          selectedBundle = bundleChosen + 107;
          break;
      }
      response = await saveUserBundleData(
        sessionId,
        selectedBundle,
        dataHandler
      );
    } else if (
      [
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
      ].includes(textLength) &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "savedBundle"
    ) {
      let recipentNumber = brokenDownText[textLength - 1];

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
      } else {
        console.log("Number is invalid");
        response = `CON Error! Inputted number is not a valid phone number\n\nEnter 0 Back to home menu`;
      }
    } else if (
      [
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
      ].includes(textLength) &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "gotRecipent"
    ) {
      let paymentMethod = brokenDownText[textLength - 1];

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
        } else {
          await redisClient.hmsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "paymentMethod",
            "coralpay",
            "userState",
            "gotPaymentMethod"
          );
          response = displayMyBankUSSDBanks();
        }
      } else {
        response =
          "CON Error!\nSelect a valid payment method\n\nEnter 0 Back to home menu";
      }
    } else if (
      [
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
      ].includes(textLength) &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "gotPaymentMethod"
    ) {
      let paymentMethod = await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      );

      let paymentDetail = brokenDownText[textLength - 1];

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
        } else {
          console.log("PIN is invalid");
          response = `CON Error!\nPIN can only be numbers\n\nEnter 0 Back to home menu`;
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
        }
      }
    } else if (
      [
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
      ].includes(textLength) &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "makePayment"
    ) {
      let paymentMethod = await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      );

      let confirmation = brokenDownText[textLength - 1];

      if (confirmation === "1") {
        response = await makePayment(paymentMethod, sessionId, phoneNumber);
      } else if (confirmation === "2") {
        response = `CON Transaction Cancelled!\n\n0 Menu`;
      }
    } else {
      response = "CON Invalid response entered\n\nEnter 0 Back to home menu";
    }
    resolve(response);
  });

  function displayBundles(codeName, start, end) {
    return new Promise((resolve) => {
      redisClient
        .existsAsync(`${APP_PREFIX_REDIS}:${codeName}BundleNames`)
        .then(async (resp) => {
          if (resp === 0) {
            let bundles = await fetchDataBundle(codeName);
            await storeBundle(codeName, bundles);
          }

          let providers = await redisClient.lrangeAsync(
            `${APP_PREFIX_REDIS}:${codeName}BundleNames`,
            start,
            end
          );

          console.log(providers);
          response = `CON Select Data Bundle:\n`;
          let index = 0;
          providers.forEach((value) => {
            response += `${++index} ${value}\n`;
          });

          if (end !== -1) {
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
    return new Promise(async (resolve) => {
      for (let bundle of Object.values(bundles)) {
        if (!Number.isInteger(bundle.price)) {
          //Excluding plans with float or unfixed prices
          continue;
        }

        let refinedName = refineName(bundle.title);

        await redisClient.rpushAsync(
          `${APP_PREFIX_REDIS}:${codeName}BundleNames`,
          refinedName
        );

        await redisClient.rpushAsync(
          `${APP_PREFIX_REDIS}:${codeName}BundlePrices`,
          bundle.price
        );
        await redisClient.rpushAsync(
          `${APP_PREFIX_REDIS}:${codeName}BundleCodes`,
          bundle.code
        );
      }

      redisClient.expire(
        `${APP_PREFIX_REDIS}:${codeName}BundleNames`,
        API_DATA_EXPIRE_TIME
      );
      redisClient.expire(
        `${APP_PREFIX_REDIS}:${codeName}BundlePrices`,
        API_DATA_EXPIRE_TIME
      );
      redisClient.expire(
        `${APP_PREFIX_REDIS}:${codeName}BundleCodes`,
        API_DATA_EXPIRE_TIME
      );

      resolve();
    });
  }

  function refineName(name) {
    let refinedName = "";
    name = name.replace(/\d+$/, "");
    refinedName = name.replace(/\s/g, "");
    return refinedName;
  }

  function saveUserBundleData(sessionId, chosenBundle, codeName) {
    return new Promise(async (resolve) => {
      let [chosenBundleName] = await redisClient.lrangeAsync(
        `${APP_PREFIX_REDIS}:${codeName}BundleNames`,
        chosenBundle,
        chosenBundle
      );

      let [chosenBundleCode] = await redisClient.lrangeAsync(
        `${APP_PREFIX_REDIS}:${codeName}BundleCodes`,
        chosenBundle,
        chosenBundle
      );

      let [dataPrice] = await redisClient.lrangeAsync(
        `${APP_PREFIX_REDIS}:${codeName}BundlePrices`,
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

      console.log(chosenBundleCode, chosenBundleName, dataPrice);

      resolve(`CON Enter Recipient's Phone Number:`);
    });
  }
}

async function handleSpectranet(
  brokenDownText,
  phoneNumber,
  sessionId,
  dataHandler
) {
  return new Promise(async (resolve) => {
    let response = "";
    let textLength = brokenDownText.length;
    if (textLength === 3) {
      response = await displayBundles(dataHandler, 0, -1);
    } else if (
      textLength === 4 &&
      parseInt(brokenDownText[textLength - 1]) <= 6 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "selectBundle"
    ) {
      let bundleChosen = parseInt(brokenDownText[textLength - 1]);
      response = await saveUserBundleData(
        sessionId,
        bundleChosen - 1,
        dataHandler
      );
    } else if (
      textLength === 5 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "savedBundle"
    ) {
      let recipentNumber = "";

      recipentNumber = brokenDownText[textLength - 1];

      if (/^[0-9]*$/.test(recipentNumber)) {
        console.log("Number is valid");
        await redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "recipentNumber",
          `${recipentNumber}`,
          "userState",
          "gotRecipent"
        );
        response = `CON Select Payment Method:\n1 My CashToken Wallet\n2 MyBankUSSD`;
      } else {
        console.log("Number is invalid");
        response = `CON Error! Inputted number is not a valid phone number\n\nEnter 0 Back to home menu`;
      }
    } else if (
      textLength === 6 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "userState"
      )) === "gotRecipent"
    ) {
      let paymentMethod = "";

      paymentMethod = brokenDownText[textLength - 1];

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
        } else {
          await redisClient.hmsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "paymentMethod",
            "coralpay",
            "userState",
            "gotPaymentMethod"
          );
          response = displayMyBankUSSDBanks();
        }
      } else {
        response =
          "CON Error!\nSelect a valid payment method\n\nEnter 0 Back to home menu";
      }
    } else if (
      textLength === 7 &&
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

      paymentDetail = brokenDownText[textLength - 1];

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
        } else {
          console.log("PIN is invalid");
          response = `CON Error!\nPIN can only be numbers\n\nEnter 0 Back to home menu`;
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
        }
      }
    } else if (
      textLength === 8 &&
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

      confirmation = brokenDownText[textLength - 1];

      if (confirmation === "1") {
        response = await makePayment(paymentMethod, sessionId, phoneNumber);
      } else if (confirmation === "2") {
        response = `CON Transaction Cancelled!\n\n0 Menu`;
      }
    } else {
      response = "CON Invalid response entered\n\nEnter 0 Back to home menu";
    }
    resolve(response);
  });

  function displayBundles(codeName, start, end) {
    return new Promise((resolve) => {
      redisClient
        .existsAsync(`${APP_PREFIX_REDIS}:${codeName}BundleNames`)
        .then(async (resp) => {
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
          providers.forEach((value) => {
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
    return new Promise(async (resolve) => {
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
      redisClient.expire(
        `${APP_PREFIX_REDIS}:${codeName}BundleNames`,
        API_DATA_EXPIRE_TIME
      );
      redisClient.expire(
        `${APP_PREFIX_REDIS}:${codeName}BundleCodes`,
        API_DATA_EXPIRE_TIME
      );
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
    return new Promise(async (resolve) => {
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

async function fetchDataBundle(code) {
  return new Promise((resolve) => {
    axios
      .get(
        `${FelaMarketPlace.BASE_URL}/list/dataBundles?provider_code=${code}`,
        {
          headers: {
            Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}`,
          },
        }
      )
      .then(async (response) => {
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
  return new Promise(async (resolve) => {
    if (paymentMethod === "felawallet") {
      let {
        recipentNumber,
        chosenDataProvider,
        dataPrice,
        chosenBundleName,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

      if (chosenDataProvider === "9mobile (Etisalat)") {
        chosenDataProvider = "9mobile";
      }

      response = `CON Confirm Data Purchase:\nRecipient's No: ${recipentNumber}\nNetwork: ${chosenDataProvider}\nPlan: ${chosenBundleName}\nPrice: ${formatNumber(
        dataPrice
      )}\nPayMethod: Wallet\n\n1 Confirm\n2 Cancel`;
      resolve(response);
    } else if (paymentMethod === "coralpay") {
      let {
        recipentNumber,
        chosenDataProvider,
        dataPrice,
        chosenBundleName,
        chosenUSSDBankName,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

      if (chosenDataProvider === "9mobile (Etisalat)") {
        chosenDataProvider = "9mobile";
      }

      response = `CON Confirm Data Purchase:\nRecipient's No: ${recipentNumber}\nNetwork: ${chosenDataProvider}\nPlan: ${chosenBundleName}\nPrice: ${formatNumber(
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
  return new Promise(async (resolve) => {
    let response = "";
    if (paymentMethod === "felawallet") {
      let {
        dataHandler,
        recipentNumber,
        chosenBundleCode,
        chosenBundleName,
        walletPin,
        dataPrice,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      response = await processDataPurchase(
        sessionId,
        phoneNumber,
        recipentNumber,
        dataHandler,
        chosenBundleCode,
        chosenBundleName,
        paymentMethod,
        dataPrice,
        walletPin
      );
    } else if (paymentMethod === "coralpay") {
      let {
        dataHandler,
        recipentNumber,
        chosenBundleCode,
        chosenBundleName,
        chosenUSSDBankCode,
        dataPrice,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      response = await processDataPurchase(
        sessionId,
        phoneNumber,
        recipentNumber,
        dataHandler,
        chosenBundleCode,
        chosenBundleName,
        paymentMethod,
        dataPrice,
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
  price,
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
        passkey: `${walletPin}`,
      },
      params: {
        account_id: `${recipentNumber}`,
        bundle_code: `${dataPlanCode}`,
        network: `${providerCode}`,
      },
      user: {
        sessionId: `${sessionId}`,
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        sourceId: `${phoneNumber}`,
        phoneNumber: `${phoneNumber}`,
      },
    };

    try {
      let response = await axios.post(
        `${FelaMarketPlace.BASE_URL}/payment/request`,
        payload,
        {
          headers: felaHeader,
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
          `${APP_PREFIX_REDIS}:reports:count:purchases_DataWithWallet:${moment().format(
            "DMMYYYY"
          )}`;
          await redisClient.incrbyAsync(
            `${APP_PREFIX_REDIS}:reports:count:totalValue_DataWithWallet:${moment().format(
              "DMMYYYY"
            )}`,
            parseInt(price)
          );
          // expireReportsInRedis(
          //   `${APP_PREFIX_REDIS}:reports:count:totalValue_DataWithWallet:${moment().format(
          //     "DMMYYYY"
          //   )}`
          // );
          resolve(
            `END Dear Customer your line ${recipentNumber} has been credited with ${dataPlanName} of Data`
          );
          break;

        case "coralpay":
          console.log("Getting response from coral pay");
          await redisClient.incrAsync(
            `${APP_PREFIX_REDIS}:reports:count:purchases_DataWithMyBankUSSD:${moment().format(
              "DMMYYYY"
            )}`
          );
          // expireReportsInRedis(
          //   `${APP_PREFIX_REDIS}:reports:count:purchases_DataWithMyBankUSSD:${moment().format(
          //     "DMMYYYY"
          //   )}`
          // );
          await redisClient.incrbyAsync(
            `${APP_PREFIX_REDIS}:reports:count:totalValue_DataWithMyBankUSSD:${moment().format(
              "DMMYYYY"
            )}`,
            parseInt(price)
          );
          // expireReportsInRedis(
          //   `${APP_PREFIX_REDIS}:reports:count:totalValue_DataWithMyBankUSSD:${moment().format(
          //     "DMMYYYY"
          //   )}`
          // );
          let paymentToken = response.data.data.paymentToken;
          // console.log(response.data);

          //   resolve(
          //     `CON Ur Bank is *${chosenUSSDBankCode}#\nNever 4GET *000*\nTrans Code is ${paymentToken}\nRem last 4 Digits!\n\nDial2Pay *${chosenUSSDBankCode}*000*${paymentToken}#\nExpires in 5mins\n\nCashback\nWin N5k-100m\n\n0 Menu`
          //   );
          // resolve(
          //   `CON To complete your transaction, dial *${chosenUSSDBankCode}*000*${paymentToken}#\nPlease note that this USSD String will expire in the next 5 minutes.\n\n 0 Menu`
          // );
          resolve(
            `END *${chosenUSSDBankCode}*000*${paymentToken}#\nDear Customer, memorize and dial the above code in your phone dialer to complete your transaction via your bank.`
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

module.exports = {
  regularBuy,
};
