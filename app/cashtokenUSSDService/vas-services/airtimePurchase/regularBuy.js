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
  return new Promise(async (resolve, reject) => {
    let response = "";
    let brokenDownText = text.split("*");
    let textLength = brokenDownText.length;

    if (textLength === 2) {
      await redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "airtime_purchase_method",
        "regularBuy"
      );
      response = await getAirtimeProviders();
    } else if (
      textLength === 3 &&
      brokenDownText[textLength - 1] <=
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
        `${brokenDownText[textLength - 1]}`
      );
      response = `CON Enter Recipient's Phone Number:`;
    } else if (textLength === 4) {
      let recipentNumber = brokenDownText[textLength - 1];
      if (testPhoneNumber(recipentNumber)) {
        console.log("Number is valid");
        await redisClient.hsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "recipentNumber",
          `${recipentNumber}`
        );
        response = `CON Enter Amount:`;
      } else {
        console.log("Number is invalid");
        response = `CON Error! Inputted number is not a valid phone number\n\nEnter 0 Back to home menu`;
      }
    } else if (textLength === 5) {
      let amount = brokenDownText[textLength - 1];

      if (/^[0-9]*$/.test(amount)) {
        console.log("Amount is valid");
        if (parseInt(amount) >= 50 && parseInt(amount) <= 100000) {
          await redisClient.hsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "airtimeAmount",
            `${amount}`
          );
          response = `CON Select Payment Method:\n1 My CashToken Wallet\n2 MyBankUSSD`;
        } else {
          console.log(
            "Amount is less than 50 naira | greater than 100,000 naira"
          );
          response = `CON Error! You can purchase airtime between the amount N50 and N100,000 only\n\n0 Menu`;
        }
      } else {
        console.log("Amount is invalid");
        response = `CON Error! Inputted amount is not a valid number\n\nEnter 0 Back to home menu`;
      }
    } else if (
      textLength === 6 &&
      parseInt(brokenDownText[textLength - 1], 10) === 1
    ) {
      console.log("Fulfiling airtime payment through wallet");
      await redisClient.hsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "airtimePaymentMethod",
        "wallet"
      );
      response = `CON Enter your wallet PIN: `;
    } else if (
      textLength === 6 &&
      parseInt(brokenDownText[textLength - 1], 10) === 2
    ) {
      console.log("Fulfiling airtime payment through MyBankUSSD");
      await redisClient.hsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "airtimePaymentMethod",
        "MyBankUSSD"
      );
      response = displayMyBankUSSDBanks();
    } else if (
      textLength === 7 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "airtimePaymentMethod"
      )) === "wallet"
    ) {
      let walletPin = brokenDownText[textLength - 1];
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
      } else {
        console.log("PIN is invalid");
        response = `CON Error! PIN can only be numbers\n\nEnter 0 Back to home menu`;
      }
    } else if (
      textLength === 7 &&
      parseInt(brokenDownText[textLength - 1], 10) <=
        Object.values(MYBANKUSSD_BANK_CODES).length &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "airtimePaymentMethod"
      )) === "MyBankUSSD"
    ) {
      let chosenUSSDBank = parseInt(brokenDownText[textLength - 1], 10);
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
    } else if (
      textLength === 8 &&
      parseInt(brokenDownText[textLength - 1], 10) === 1 &&
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

      response = await processAirtimePurchase(
        sessionId,
        phoneNumber,
        recipentNumber,
        airtimeAmount,
        providerCode,
        "felawallet",
        walletPin
      );
    } else if (
      textLength === 8 &&
      parseInt(brokenDownText[textLength - 1], 10) === 1 &&
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

      response = await processAirtimePurchase(
        sessionId,
        phoneNumber,
        recipentNumber,
        airtimeAmount,
        providerCode,
        "coralpay",
        undefined,
        chosenUSSDBankCode
      );
    } else if (
      textLength === 8 &&
      parseInt(brokenDownText[textLength], 10) === 2 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "airtimePaymentMethod"
      )) === "wallet"
    ) {
      response = `CON Transaction Cancelled!\n\nEnter 0 Back to home menu`;
    } else if (
      textLength === 8 &&
      parseInt(brokenDownText[textLength - 1], 10) === 2 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "airtimePaymentMethod"
      )) === "MyBankUSSD"
    ) {
      response = `CON Transaction Cancelled!\n\nEnter 0 Back to home menu`;
    } else {
      response = "CON Invalid response entered\n\nEnter 0 Back to home menu";
    }

    resolve(response);
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
        // response += `0 Main menu`;

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
            `END Dear Customer, your line ${recipentNumber} has been successfully credited with ${NAIRASIGN}${formatNumber(
              airtimeAmount
            )} Airtime`
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
