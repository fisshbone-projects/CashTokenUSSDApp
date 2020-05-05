const { redisClient } = require("../redisConnectConfig");
const { FelaMarketPlace, App } = require("../index");
const {
  APP_PREFIX_REDIS,
  expireReportsInRedis,
  formatNumber,
  MYBANKUSSD_BANK_CODES,
} = require("../utils");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
// const NAIRASIGN = "\u{020A6}";
const NAIRASIGN = "N";
const API_DATA_EXPIRE_TIME = parseInt(App.REDIS_API_DATA_EXPIRE);
const moment = require("moment");

async function process1KOnlyAirtime(text, phoneNumber, sessionId) {
  return new Promise(async (resolve) => {
    console.log("Starting 1K only Airtime purchase Process");
    let response = "";
    if (text.startsWith("3")) {
      let brokenDownText = text.split("*");
      response = await airtime1KOnlyFlow(
        brokenDownText,
        phoneNumber,
        sessionId
      );
      resolve(response);
    } else {
      response = "CON Invalid response inputed\n\nEnter 0 Back to home menu";
      resolve(response);
    }
  });
}

async function airtime1KOnlyFlow(brokenDownText, phoneNumber, sessionId) {
  return new Promise(async (resolve) => {
    let response = "";

    if (brokenDownText.length === 1) {
      await redisClient.incrAsync(
        `${APP_PREFIX_REDIS}:reports:count:topMenu_Airtime1K:${moment().format(
          "DMMYYYY"
        )}`
      );
      // expireReportsInRedis(
      //   `${APP_PREFIX_REDIS}:reports:count:topMenu_Airtime1K:${moment().format(
      //     "DMMYYYY"
      //   )}`
      // );
      response = `CON 1K Airtime Self Service\n`;
      let listOfBundle = await generateAirtimeBundle();
      response += listOfBundle;
      resolve(response);
    } else if (
      brokenDownText.length === 2 &&
      parseInt(brokenDownText[1]) <= 8
    ) {
      //getInfo and show confirmation
      response = await getPurchaseConfirmation(
        brokenDownText,
        phoneNumber,
        sessionId
      );
      resolve(response);
    } else if (
      brokenDownText.length === 2 &&
      parseInt(brokenDownText[1]) === 11
    ) {
      response = `CON 1K Airtime Self Service\n`;
      let listOfBundle = await generateAirtimeBundle(true);
      response += listOfBundle;
      resolve(response);
    } else if (
      brokenDownText.length === 3 &&
      parseInt(brokenDownText[2]) == 1 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "confirmPurchase"
      )) == "true"
    ) {
      let { providerCode, chosenBankCode } = await redisClient.hgetallAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`
      );
      response = await processAirtimePurchase(
        sessionId,
        phoneNumber,
        providerCode,
        chosenBankCode
      );
      resolve(response);
    } else if (
      brokenDownText.length === 3 &&
      parseInt(brokenDownText[2]) == 2 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "confirmPurchase"
      )) == "true"
    ) {
      response = `CON Transaction Cancelled!\n\nEnter 0 Back to home menu`;
      resolve(response);
    } else if (
      brokenDownText.length === 3 &&
      parseInt(brokenDownText[2]) <= 8
    ) {
      response = await getPurchaseConfirmation(
        brokenDownText,
        phoneNumber,
        sessionId
      );
      resolve(response);
    } else if (
      brokenDownText.length === 4 &&
      parseInt(brokenDownText[3]) == 1 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "confirmPurchase"
      )) == "true"
    ) {
      let { providerCode, chosenBankCode } = await redisClient.hgetallAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`
      );
      response = await processAirtimePurchase(
        sessionId,
        phoneNumber,
        providerCode,
        chosenBankCode
      );
      resolve(response);
    } else if (
      brokenDownText.length === 4 &&
      parseInt(brokenDownText[3]) == 2 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "confirmPurchase"
      )) == "true"
    ) {
      response = `CON Transaction Cancelled!\n\nEnter 0 Back to home menu`;
      resolve(response);
    } else {
      response = "CON Invalid response inputed\n\nEnter 0 Back to home menu";
      resolve(response);
    }
  });
}

async function generateAirtimeBundle(nextPage = false) {
  return new Promise((resolve) => {
    redisClient
      .existsAsync(`${APP_PREFIX_REDIS}:AirtimeProvidersNames`)
      .then(async (resp) => {
        let response = "";
        if (resp === 0) {
          await fetchAirtimeProviders();
        }

        let providers = await redisClient.zrangeAsync(
          `${APP_PREFIX_REDIS}:AirtimeProvidersNames`,
          0,
          -1
        );

        let topBanksName;

        if (!nextPage) {
          topBanksName = Object.keys(MYBANKUSSD_BANK_CODES).filter((value) => {
            return value.includes("GTB") || value.includes("Access");
          });
        } else {
          topBanksName = Object.keys(MYBANKUSSD_BANK_CODES).filter((value) => {
            return value.includes("UBA") || value.includes("Zenith");
          });
        }

        let index = 0;

        topBanksName.sort().forEach((bank) => {
          providers.forEach((provider) => {
            response += `${++index} ${
              provider.includes("9mobile") ? "9mobile" : provider
            }/${bank}\n`;
          });
        });

        if (!nextPage) {
          response += "11 Next";
        }

        resolve(response);
      });
  });
}

async function getPurchaseConfirmation(brokenDownText, phoneNumber, sessionId) {
  return new Promise(async (resolve) => {
    let providerCode;
    let providerName;
    let chosenBankName;
    let chosenBankCode;
    let response = "";

    if (brokenDownText.length == 2 && Number(brokenDownText[1]) <= 4) {
      [providerCode] = await redisClient.zrangeAsync(
        `${APP_PREFIX_REDIS}:AirtimeProvidersCodes`,
        Number(brokenDownText[1]) - 1,
        Number(brokenDownText[1]) - 1
      );
      [providerName] = await redisClient.zrangeAsync(
        `${APP_PREFIX_REDIS}:AirtimeProvidersNames`,
        Number(brokenDownText[1]) - 1,
        Number(brokenDownText[1]) - 1
      );

      chosenBankName = "Access";
      chosenBankCode = MYBANKUSSD_BANK_CODES[chosenBankName];
    } else if (
      brokenDownText.length == 2 &&
      Number(brokenDownText[1]) >= 5 &&
      Number(brokenDownText[1]) <= 8
    ) {
      [providerCode] = await redisClient.zrangeAsync(
        `${APP_PREFIX_REDIS}:AirtimeProvidersCodes`,
        Number(brokenDownText[1]) - 5,
        Number(brokenDownText[1]) - 5
      );
      [providerName] = await redisClient.zrangeAsync(
        `${APP_PREFIX_REDIS}:AirtimeProvidersNames`,
        Number(brokenDownText[1]) - 5,
        Number(brokenDownText[1]) - 5
      );

      chosenBankName = "GTB";
      chosenBankCode = MYBANKUSSD_BANK_CODES[chosenBankName];
    }

    if (brokenDownText.length == 3 && Number(brokenDownText[2]) <= 4) {
      [providerCode] = await redisClient.zrangeAsync(
        `${APP_PREFIX_REDIS}:AirtimeProvidersCodes`,
        Number(brokenDownText[2]) - 1,
        Number(brokenDownText[2]) - 1
      );
      [providerName] = await redisClient.zrangeAsync(
        `${APP_PREFIX_REDIS}:AirtimeProvidersNames`,
        Number(brokenDownText[2]) - 1,
        Number(brokenDownText[2]) - 1
      );

      chosenBankName = "UBA";
      chosenBankCode = MYBANKUSSD_BANK_CODES[chosenBankName];
    } else if (
      brokenDownText.length == 3 &&
      Number(brokenDownText[2]) >= 5 &&
      Number(brokenDownText[2]) <= 8
    ) {
      [providerCode] = await redisClient.zrangeAsync(
        `${APP_PREFIX_REDIS}:AirtimeProvidersCodes`,
        Number(brokenDownText[2]) - 5,
        Number(brokenDownText[2]) - 5
      );
      [providerName] = await redisClient.zrangeAsync(
        `${APP_PREFIX_REDIS}:AirtimeProvidersNames`,
        Number(brokenDownText[2]) - 5,
        Number(brokenDownText[2]) - 5
      );

      chosenBankName = "Zenith";
      chosenBankCode = MYBANKUSSD_BANK_CODES[chosenBankName];
    }

    await redisClient.hmsetAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`,
      "providerCode",
      providerCode,
      "providerName",
      providerName,
      "chosenBankName",
      chosenBankName,
      "chosenBankCode",
      chosenBankCode,
      "confirmPurchase",
      "true"
    );

    response = `CON Confirm Airtime Purchase:\nRecipient's Line: ${
      providerName.includes("9mobile") ? "9mobile" : providerName
    }\nRecipient's Number: Self\nAmount: ${NAIRASIGN}${formatNumber(
      "1000"
    )}\nPayment Method: ${
      chosenBankName.includes("bank") ||
      chosenBankName == "GTB" ||
      chosenBankName == "FBN" ||
      chosenBankName == "UBA"
        ? chosenBankName
        : `${chosenBankName} Bank`
    }\n\n1 Confirm\n2 Cancel`;

    resolve(response);
  });
}

async function fetchAirtimeProviders() {
  return new Promise((resolve) => {
    axios
      .get(`${FelaMarketPlace.BASE_URL}/list/airtimeProviders`, {
        headers: {
          Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER} `,
        },
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

function processAirtimePurchase(
  sessionId,
  phoneNumber,
  providerCode,
  chosenUSSDBankCode
) {
  return new Promise(async (resolve, reject) => {
    let payload = {
      offeringGroup: "core",
      offeringName: "airtime",
      method: "coralpay",
      auth: {
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        passkey: "",
      },
      params: {
        recipient: `${phoneNumber}`,
        amount: "1000",
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

      console.log("Getting response from coral pay");
      let paymentToken = response.data.data.paymentToken;
      // console.log(response.data);

      await redisClient.incrAsync(
        `${APP_PREFIX_REDIS}:reports:count:purchases_Airtime1KBundle:${moment().format(
          "DMMYYYY"
        )}`
      );
      // expireReportsInRedis(
      //   `${APP_PREFIX_REDIS}:reports:count:purchases_Airtime1KBundle:${moment().format(
      //     "DMMYYYY"
      //   )}`
      // );

      await redisClient.incrbyAsync(
        `${APP_PREFIX_REDIS}:reports:count:totalValue_Airtime1KBundle:${moment().format(
          "DMMYYYY"
        )}`,
        parseInt(1000)
      );
      // expireReportsInRedis(
      //   `${APP_PREFIX_REDIS}:reports:count:totalValue_Airtime1KBundle:${moment().format(
      //     "DMMYYYY"
      //   )}`
      // );

      // resolve(
      //   `CON Ur Bank is *${chosenUSSDBankCode}#\nNever 4GET *000*\nTrans Code is ${paymentToken}\nRem last 4 Digits!\n\nDial2Pay *${chosenUSSDBankCode}*000*${paymentToken}#\nExpires in 5mins\n\nCashback\nWin N5k-100m\n\n0 Menu`
      // );

      // resolve(
      //   `CON To complete your transaction, dial *${chosenUSSDBankCode}*000*${paymentToken}#\nPlease note that this USSD String will expire in the next 5 minutes.\n\n 0 Menu`
      // );
      resolve(
        `END *${chosenUSSDBankCode}*000*${paymentToken}#\nDear Customer, memorize and dial the above code in your phone dialer to complete your transaction via your bank.`
      );
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
  process1KOnlyAirtime,
};
