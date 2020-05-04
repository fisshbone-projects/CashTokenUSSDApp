const { redisClient } = require("../redisConnectConfig");
const { FelaMarketPlace, App } = require("../index");
const { sendSMS } = require("../infoBipConfig");
const moment = require("moment");
const {
  APP_PREFIX_REDIS,
  testPhoneNumber,
  formatNumber,
  MYBANKUSSD_BANK_CODES,
  expireReportsInRedis,
} = require("../utils");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
// const NAIRASIGN = "\u{020A6}";
const NAIRASIGN = "N";
const API_DATA_EXPIRE_TIME = parseInt(App.REDIS_API_DATA_EXPIRE);

async function processAirtime(text, phoneNumber, sessionId) {
  return new Promise(async (resolve, reject) => {
    console.log("Starting Airtime Purchase Process");
    let response = "";
    if (text.startsWith("2")) {
      let brokenDownText = text.split("*");
      response = await airtimeFlow(brokenDownText, phoneNumber, sessionId);
      resolve(response);
    } else {
      response = "CON Invalid response inputed\n\nEnter 0 Back to home menu";
      resolve(response);
    }
  });
}

async function airtimeFlow(brokenDownText, phoneNumber, sessionId) {
  return new Promise(async (resolve, reject) => {
    let response = "";

    if (brokenDownText.length === 1) {
      await redisClient.incrAsync(
        `${APP_PREFIX_REDIS}:reports:count:topMenu_Airtime:${moment().format(
          "DMMYYYY"
        )}`
      );
      // expireReportsInRedis(
      //   `${APP_PREFIX_REDIS}:reports:count:topMenu_Airtime:${moment().format(
      //     "DMMYYYY"
      //   )}`
      // );
      response = await getAirtimeProviders();
      // response = `CON Enter Recipient's Phone Number:`;
      resolve(response);
    } else if (
      brokenDownText.length === 2 &&
      brokenDownText[1] <=
        parseInt(
          await redisClient.zcardAsync(
            `${APP_PREFIX_REDIS}:AirtimeProvidersNames`
          ),
          10
        )
    ) {
      await redisClient.hsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "recipentLine",
        `${brokenDownText[1]}`
      );
      response = `CON Enter Recipient's Phone Number:`;
      resolve(response);
    } else if (brokenDownText.length === 3) {
      let recipentNumber = brokenDownText[2];
      if (testPhoneNumber(recipentNumber)) {
        console.log("Number is valid");
        await redisClient.hsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "recipentNumber",
          `${recipentNumber}`
        );
        response = `CON Enter Amount:`;
        resolve(response);
      } else {
        console.log("Number is invalid");
        response = `CON Error! Inputted number is not a valid phone number\n\nEnter 0 to start over`;
        resolve(response);
      }
    } else if (brokenDownText.length === 4) {
      let amount = brokenDownText[3];
      if (/^[0-9]*$/.test(amount)) {
        console.log("Amount is valid");
        await redisClient.hsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "airtimeAmount",
          `${amount}`
        );

        response = `CON Select Payment Method:\n1 My CashToken Wallet\n2 MyBankUSSD`;
        resolve(response);
      } else {
        console.log("Amount is invalid");
        response = `CON Error! Inputted amount is not a valid number\n\nEnter 0 to start over`;
        resolve(response);
      }
    } else if (
      brokenDownText.length === 5 &&
      parseInt(brokenDownText[4], 10) === 1
    ) {
      console.log("Fulfiling airtime payment through wallet");
      await redisClient.hsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "airtimePaymentMethod",
        "wallet"
      );
      response = `CON Enter your wallet PIN: `;
      resolve(response);
    } else if (
      brokenDownText.length === 5 &&
      parseInt(brokenDownText[4], 10) === 2
    ) {
      console.log("Fulfiling airtime payment through MyBankUSSD");
      await redisClient.hsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "airtimePaymentMethod",
        "MyBankUSSD"
      );
      response = displayMyBankUSSDBanks();
      resolve(response);
    } else if (
      brokenDownText.length === 6 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "airtimePaymentMethod"
      )) === "wallet"
    ) {
      let walletPin = brokenDownText[5];
      if (/^[0-9]*$/.test(walletPin)) {
        await redisClient.hsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "walletPin",
          `${walletPin}`
        );
        let {
          airtimeAmount,
          recipentNumber,
          recipentLine,
        } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
        let [airtimeProvider] = await redisClient.zrangebyscoreAsync(
          `${APP_PREFIX_REDIS}:AirtimeProvidersNames`,
          recipentLine,
          recipentLine
        );

        response = `CON Confirm Airtime Purchase:\nRecipient's Line: ${
          airtimeProvider.includes("Etisalat") ? "9mobile" : airtimeProvider
        }\nRecipient's Number: ${recipentNumber}\nAmount: ${NAIRASIGN}${formatNumber(
          airtimeAmount
        )}\nPayment Method: Wallet\n\n1 Confirm\n2 Cancel`;
        resolve(response);
      } else {
        console.log("PIN is invalid");
        response = `CON Error! PIN can only be numbers\n\nEnter 0 to start over`;
        resolve(response);
      }
    } else if (
      brokenDownText.length === 6 &&
      parseInt(brokenDownText[5], 10) <=
        Object.values(MYBANKUSSD_BANK_CODES).length &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "airtimePaymentMethod"
      )) === "MyBankUSSD"
    ) {
      let chosenUSSDBank = parseInt(brokenDownText[5], 10);
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
        chosenUSSDBankCode
      );

      let {
        airtimeAmount,
        recipentNumber,
        recipentLine,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      let [airtimeProvider] = await redisClient.zrangebyscoreAsync(
        `${APP_PREFIX_REDIS}:AirtimeProvidersNames`,
        recipentLine,
        recipentLine
      );

      response = `CON Confirm Airtime Purchase:\nRecipient's Line: ${
        airtimeProvider.includes("9mobile") ? "9mobile" : airtimeProvider
      }\nRecipient's Number: ${recipentNumber}\nAmount: ${NAIRASIGN}${formatNumber(
        airtimeAmount
      )}\nPayment Method: ${
        chosenUSSDBankName.includes("bank") ||
        chosenUSSDBankName == "GTB" ||
        chosenUSSDBankName == "FBN" ||
        chosenUSSDBankName == "UBA"
          ? chosenUSSDBankName
          : `${chosenUSSDBankName} Bank`
      }\n\n1 Confirm\n2 Cancel`;

      resolve(response);
    } else if (
      brokenDownText.length === 7 &&
      parseInt(brokenDownText[6], 10) === 1 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "airtimePaymentMethod"
      )) === "wallet"
    ) {
      let {
        airtimeAmount,
        recipentNumber,
        recipentLine,
        walletPin,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      let [providerCode] = await redisClient.zrangebyscoreAsync(
        `${APP_PREFIX_REDIS}:AirtimeProvidersCodes`,
        recipentLine,
        recipentLine
      );

      let response = await processAirtimePurchase(
        sessionId,
        phoneNumber,
        recipentNumber,
        airtimeAmount,
        providerCode,
        "felawallet",
        walletPin
      );
      resolve(response);
    } else if (
      brokenDownText.length === 7 &&
      parseInt(brokenDownText[6], 10) === 1 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "airtimePaymentMethod"
      )) === "MyBankUSSD"
    ) {
      // let {
      //   airtimeAmount,
      //   recipentNumber,
      //   chosenUSSDBankCode,
      //   chosenUSSDBankName
      // } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

      let {
        airtimeAmount,
        recipentNumber,
        recipentLine,
        chosenUSSDBankCode,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      let [providerCode] = await redisClient.zrangebyscoreAsync(
        `${APP_PREFIX_REDIS}:AirtimeProvidersCodes`,
        recipentLine,
        recipentLine
      );

      // let response = await processAirtimeUSSDString(
      //   phoneNumber,
      //   recipentNumber,
      //   airtimeAmount,
      //   chosenUSSDBankCode
      // );

      let response = await processAirtimePurchase(
        sessionId,
        phoneNumber,
        recipentNumber,
        airtimeAmount,
        providerCode,
        "coralpay",
        undefined,
        chosenUSSDBankCode
      );
      resolve(response);
    } else if (
      brokenDownText.length === 7 &&
      parseInt(brokenDownText[6], 10) === 2 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "airtimePaymentMethod"
      )) === "wallet"
    ) {
      response = `CON Transaction Cancelled!\n\nEnter 0 Back to home menu`;
      resolve(response);
    } else if (
      brokenDownText.length === 7 &&
      parseInt(brokenDownText[6], 10) === 2 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "airtimePaymentMethod"
      )) === "MyBankUSSD"
    ) {
      response = `CON Transaction Cancelled!\n\nEnter 0 Back to home menu`;
      resolve(response);
    } else {
      response = "CON Invalid response inputed\n\nEnter 0 Back to home menu";
      resolve(response);
    }
  });
}

function getAirtimeProviders() {
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

        response = `CON Select Recipent's Network:\n`;

        providers.forEach((provider, index) => {
          response += `${++index} ${provider}\n`;
        });
        response += `# Back\n0 Main Menu`;

        resolve(response);
      });
  });
}

async function fetchAirtimeProviders() {
  return new Promise((resolve) => {
    axios
      .get(`${FelaMarketPlace.BASE_URL}/list/airtimeProviders`, {
        headers: {
          Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}`,
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

function displayMyBankUSSDBanks() {
  let response = "CON Select your Bank:\n";
  let bankNames = Object.keys(MYBANKUSSD_BANK_CODES);

  for (let [index, bank] of bankNames.entries()) {
    response += `${++index} ${bank}\n`;
  }
  return response;
}

function processAirtimePurchase(
  sessionId,
  phoneNumber,
  recipentNumber,
  airtimeAmount,
  providerCode,
  paymentMethod,
  walletPin = "",
  chosenUSSDBankCode = ""
) {
  return new Promise(async (resolve, reject) => {
    let payload = {
      offeringGroup: "core",
      offeringName: "airtime",
      method: paymentMethod,
      auth: {
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        passkey: `${walletPin}`,
      },
      params: {
        recipient: `${recipentNumber}`,
        amount: `${airtimeAmount}`,
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
            `${APP_PREFIX_REDIS}:reports:count:purchases_AirtimeWithWallet:${moment().format(
              "DMMYYYY"
            )}`
          );
          // expireReportsInRedis(
          //   `${APP_PREFIX_REDIS}:reports:count:purchases_AirtimeWithWallet:${moment().format(
          //     "DMMYYYY"
          //   )}`
          // );
          await redisClient.incrbyAsync(
            `${APP_PREFIX_REDIS}:reports:count:totalValue_AirtimeWithWallet:${moment().format(
              "DMMYYYY"
            )}`,
            parseInt(airtimeAmount)
          );
          // expireReportsInRedis(
          //   `${APP_PREFIX_REDIS}:reports:count:totalValue_AirtimeWithWallet:${moment().format(
          //     "DMMYYYY"
          //   )}`
          // );
          resolve(
            `CON Dear Customer, your line ${recipentNumber} has been successfully credited with ${NAIRASIGN}${formatNumber(
              airtimeAmount
            )} Airtime\n\n0 Menu`
          );
          break;

        case "coralpay":
          console.log("Getting response from coral pay");
          await redisClient.incrAsync(
            `${APP_PREFIX_REDIS}:reports:count:purchases_AirtimeWithMyBankUSSD:${moment().format(
              "DMMYYYY"
            )}`
          );
          // expireReportsInRedis(
          //   `${APP_PREFIX_REDIS}:reports:count:purchases_AirtimeWithMyBankUSSD:${moment().format(
          //     "DMMYYYY"
          //   )}`
          // );
          await redisClient.incrbyAsync(
            `${APP_PREFIX_REDIS}:reports:count:totalValue_AirtimeWithMyBankUSSD:${moment().format(
              "DMMYYYY"
            )}`,
            parseInt(airtimeAmount)
          );
          // expireReportsInRedis(
          //   `${APP_PREFIX_REDIS}:reports:count:totalValue_AirtimeWithMyBankUSSD:${moment().format(
          //     "DMMYYYY"
          //   )}`
          // );
          let paymentToken = response.data.data.paymentToken;
          // console.log(response.data);

          // resolve(
          //   `CON Ur Bank is *${chosenUSSDBankCode}#\nNever 4GET *000*\nTrans Code is ${paymentToken}\nRem last 4 Digits!\n\nDial2Pay *${chosenUSSDBankCode}*000*${paymentToken}#\nExpires in 5mins\n\nCashback\nWin N5k-100m\n\n0 Menu`
          // );
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

module.exports = {
  processAirtime,
};
