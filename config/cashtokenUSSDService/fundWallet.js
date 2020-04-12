const { redisClient } = require("../redisConnectConfig");
const { FelaMarketPlace } = require("../index");
const moment = require("moment");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
const {
  APP_PREFIX_REDIS,
  testPhoneNumber,
  formatNumber,
  MYBANKUSSD_BANK_CODES
} = require("../utils");
const NAIRASIGN = "N";

async function processFundWallet(phoneNumber, text, sessionId) {
  return new Promise(async (resolve, reject) => {
    console.log("Starting CashToken Purchase Process");
    let response = "";
    if (text.startsWith("1*3")) {
      let brokenDownText = text.split("*");
      //   brokenDownText.unshift("dummyInsert");
      response = await fundWalletFlow(brokenDownText, phoneNumber, sessionId);
      resolve(response);
    } else {
      response = "CON Error!\nInvalid input\n\nEnter 0 to start over";
      resolve(response);
    }
  });
}

async function fundWalletFlow(brokenDownText, phoneNumber, sessionId) {
  return new Promise(async (resolve, reject) => {
    let response = "";
    if (brokenDownText.length === 2) {
      await redisClient.incrAsync(
        `${APP_PREFIX_REDIS}:reports:count:subMenu_FundWallet:${moment().format(
          "DMMYYYY"
        )}`
      );

      response = `CON Insert Amount:`;
      resolve(response);
    } else if (brokenDownText.length === 3) {
      let amount = brokenDownText[2];
      if (/^[0-9]*$/.test(amount)) {
        console.log("Amount is valid");
        await redisClient.hsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "amount",
          `${amount}`
        );

        response = displayMyBankUSSDBanks();
        resolve(response);
      } else {
        console.log("Amount is invalid");
        response = `CON Error! Inputted amount is not a valid number\n\n0 Menu`;
        resolve(response);
      }
    } else if (
      brokenDownText.length === 4 &&
      parseInt(brokenDownText[3], 10) <=
        Object.values(MYBANKUSSD_BANK_CODES).length
    ) {
      let chosenUSSDBank = parseInt(brokenDownText[3], 10);
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

      let { amount } = await redisClient.hgetallAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`
      );

      response = `CON Confirm Fund Wallet Transaction:\nRecipient's Number: ${phoneNumber}\nAmount: ${NAIRASIGN}${formatNumber(
        amount
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
      brokenDownText.length === 5 &&
      parseInt(brokenDownText[4], 10) === 1
    ) {
      let { amount, chosenUSSDBankCode } = await redisClient.hgetallAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`
      );
      let response = await processCashTokenPurchase(
        sessionId,
        phoneNumber,
        amount,
        "coralpay",
        chosenUSSDBankCode
      );
      resolve(response);
    } else if (
      brokenDownText.length === 5 &&
      parseInt(brokenDownText[4], 10) === 2
    ) {
      response = `CON Transaction Cancelled!\n\n0 Menu`;
      resolve(response);
    } else {
      response = "CON Error!\nInvalid input\n\nEnter 0 to start over";
      resolve(response);
    }
  });
}

function processCashTokenPurchase(
  sessionId,
  phoneNumber,
  amount,
  paymentMethod,
  chosenUSSDBankCode
) {
  return new Promise(async (resolve, reject) => {
    let payload = {
      offeringGroup: "felawallet",
      offeringName: "fund",
      method: paymentMethod,
      auth: {
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        passkey: ""
      },
      params: {
        amount: `${amount}`
      },
      user: {
        sessionId: `${sessionId}`,
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        sourceId: `${phoneNumber}`,
        phoneNumber: `${phoneNumber}`
      }
    };
    try {
      let response = await axios.post(
        `${FelaMarketPlace.BASE_URL}/payment/request`,
        payload,
        {
          headers: felaHeader
        }
      );
      switch (paymentMethod) {
        case "coralpay":
          console.log("Geting response from coral pay");
          let paymentToken = response.data.data.paymentToken;
          // console.log(response.data);
          await redisClient.incrAsync(
            `${APP_PREFIX_REDIS}:reports:count:purchases_GiftCashTokenWithMyBankUSSD:${moment().format(
              "DMMYYYY"
            )}`
          );
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
      if (error.response.data.code === 422) {
        resolve(
          `CON Transaction Failed!\n${error.response.data.data.message}\n\n0 Menu`
        );
      } else {
        resolve(`CON Transaction Failed!\nPlease try again later\n0 Menu`);
      }
    }
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

module.exports = {
  processFundWallet
};
