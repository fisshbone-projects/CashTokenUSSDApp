const { redisClient } = require("$config/redisConnectConfig");
const { FelaMarketPlace } = require("$config/index");
const moment = require("moment");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
const {
  APP_PREFIX_REDIS,
  testPhoneNumber,
  formatNumber,
  MYBANKUSSD_BANK_CODES,
  expireReportsInRedis,
} = require("$utils");
const CASHTOKENPRICE = 50;
// const { sendSMS } = require("$config/infoBipConfig");
// const NAIRASIGN = "\u{020A6}";
const NAIRASIGN = "N";

async function processGiftCashToken(phoneNumber, text, sessionId) {
  return new Promise(async (resolve, reject) => {
    console.log("Starting CashToken Purchase Process");
    let response = "";

    let brokenDownText = text.split("*");
    brokenDownText.unshift("dummyInsert");
    response = await giftCashTokenFlow(brokenDownText, phoneNumber, sessionId);
    resolve(response);
  });
}

async function giftCashTokenFlow(brokenDownText, phoneNumber, sessionId) {
  return new Promise(async (resolve, reject) => {
    let response = "";
    if (brokenDownText.length === 2) {
      await redisClient.incrAsync(
        `${APP_PREFIX_REDIS}:reports:count:topMenu_GiftCashToken:${moment().format(
          "DMMYYYY"
        )}`
      );
      // expireReportsInRedis(
      //   `${APP_PREFIX_REDIS}:reports:count:topMenu_GiftCashToken:${moment().format(
      //     "DMMYYYY"
      //   )}`
      // );
      response = `CON Enter Phone Number to Gift:`;
      resolve(response);
    } else if (brokenDownText.length === 3) {
      let numberToCredit = brokenDownText[2];
      if (testPhoneNumber(numberToCredit)) {
        console.log("Number is valid");
        await redisClient.hsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "numberToCredit",
          `${numberToCredit}`
        );
        response = `CON Insert Number of CashTokens to Gift:`;
        resolve(response);
      } else {
        console.log("Number is invalid");
        response = `CON Error! Inputted number is not a valid phone number\n\n0 Menu`;
        resolve(response);
      }
    } else if (brokenDownText.length === 4) {
      let amount = brokenDownText[3];
      if (/^[0-9]*$/.test(amount)) {
        console.log("Amount is valid");
        await redisClient.hsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "amount",
          `${amount}`
        );
        // response = `CON Enter your wallet PIN: `;
        response = `CON Select Payment Method:\n1 My CashToken Wallet\n2 MyBankUSSD`;
        resolve(response);
      } else {
        console.log("Amount is invalid");
        response = `CON Error! Inputted amount is not a valid number\n\n0 Menu`;
        resolve(response);
      }
    } else if (
      brokenDownText.length === 5 &&
      parseInt(brokenDownText[4], 10) === 1
    ) {
      console.log("Fulfiling cashtoken purchase through wallet");
      await redisClient.hsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod",
        "wallet"
      );
      response = `CON Enter your wallet PIN: `;
      resolve(response);
    } else if (
      brokenDownText.length === 5 &&
      parseInt(brokenDownText[4], 10) === 2
    ) {
      console.log("Fulfiling cashtoken purchase through MyBankUSSD");
      await redisClient.hsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod",
        "MyBankUSSD"
      );
      response = displayMyBankUSSDBanks();
      resolve(response);
    } else if (
      brokenDownText.length === 6 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      )) === "wallet"
    ) {
      let walletPin = brokenDownText[5];
      if (/^[0-9]*$/.test(walletPin)) {
        await redisClient.hsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "walletPin",
          `${walletPin}`
        );
        let { amount, numberToCredit } = await redisClient.hgetallAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`
        );

        response = `CON Confirm CashToken Purchase:\nRecipient's Number: ${numberToCredit}\nAmount to Gift: ${amount}\nPrice to Pay: ${NAIRASIGN}${formatNumber(
          parseInt(amount) * CASHTOKENPRICE
        )}\nPayment Method: Wallet\n\n1 Confirm\n2 Cancel`;
        resolve(response);
      } else {
        console.log("PIN is invalid");
        response = `CON Error! PIN can only be numbers\n\n0 Menu`;
        resolve(response);
      }
    } else if (
      brokenDownText.length === 6 &&
      parseInt(brokenDownText[5], 10) <=
        Object.values(MYBANKUSSD_BANK_CODES).length &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
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

      let { amount, numberToCredit } = await redisClient.hgetallAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`
      );

      response = `CON Confirm CashToken Purchase:\nRecipient's Number: ${numberToCredit}\nAmount to Gift: ${amount}\nPrice to Pay: ${NAIRASIGN}${formatNumber(
        parseInt(amount) * CASHTOKENPRICE
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
        "paymentMethod"
      )) === "wallet"
    ) {
      let {
        amount,
        numberToCredit,
        walletPin,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      let response = await processCashTokenPurchase(
        sessionId,
        phoneNumber,
        numberToCredit,
        amount,
        "felawallet",
        walletPin
      );
      resolve(response);
    } else if (
      brokenDownText.length === 7 &&
      parseInt(brokenDownText[6], 10) === 1 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      )) === "MyBankUSSD"
    ) {
      let {
        amount,
        numberToCredit,
        chosenUSSDBankCode,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      let response = await processCashTokenPurchase(
        sessionId,
        phoneNumber,
        numberToCredit,
        amount,
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
        "paymentMethod"
      )) === "wallet"
    ) {
      response = `CON Transaction Cancelled!\n\n0 Menu`;
      resolve(response);
    } else if (
      brokenDownText.length === 7 &&
      parseInt(brokenDownText[6], 10) === 2 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      )) === "MyBankUSSD"
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
  numberToCredit,
  amount,
  paymentMethod,
  walletPin = "",
  chosenUSSDBankCode = ""
) {
  return new Promise(async (resolve, reject) => {
    let payload = {
      offeringGroup: "cashtoken",
      offeringName: "buy",
      method: paymentMethod,
      auth: {
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        passkey: `${walletPin}`,
      },
      params: {
        recipient: `${numberToCredit}`,
        qty: `${amount}`,
        mode: "buyAndGift",
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
            `${APP_PREFIX_REDIS}:reports:count:purchases_GiftCashTokenWithWallet:${moment().format(
              "DMMYYYY"
            )}`
          );
          // expireReportsInRedis(
          //   `${APP_PREFIX_REDIS}:reports:count:purchases_GiftCashTokenWithWallet:${moment().format(
          //     "DMMYYYY"
          //   )}`
          // );
          await redisClient.incrbyAsync(
            `${APP_PREFIX_REDIS}:reports:count:totalValue_GiftCashTokenWithWallet:${moment().format(
              "DMMYYYY"
            )}`,
            parseInt(amount) * 35
          );
          // expireReportsInRedis(
          //   `${APP_PREFIX_REDIS}:reports:count:totalValue_GiftCashTokenWithWallet:${moment().format(
          //     "DMMYYYY"
          //   )}`
          // );
          resolve(
            `CON Dear Customer, this number ${numberToCredit} has been successfully gifted with ${amount} CashTokens\n\n0 Menu`
          );
          break;

        case "coralpay":
          console.log("Geting response from coral pay");
          let paymentToken = response.data.data.paymentToken;
          // console.log(response.data);
          await redisClient.incrAsync(
            `${APP_PREFIX_REDIS}:reports:count:purchases_GiftCashTokenWithMyBankUSSD:${moment().format(
              "DMMYYYY"
            )}`
          );
          // expireReportsInRedis(
          //   `${APP_PREFIX_REDIS}:reports:count:purchases_GiftCashTokenWithMyBankUSSD:${moment().format(
          //     "DMMYYYY"
          //   )}`
          // );
          await redisClient.incrbyAsync(
            `${APP_PREFIX_REDIS}:reports:count:totalValue_GiftCashTokenWithMyBankUSSD:${moment().format(
              "DMMYYYY"
            )}`,
            parseInt(amount) * 35
          );
          // expireReportsInRedis(
          //   `${APP_PREFIX_REDIS}:reports:count:totalValue_GiftCashTokenWithMyBankUSSD:${moment().format(
          //     "DMMYYYY"
          //   )}`
          // );
          resolve(
            `CON Ur Bank is *${chosenUSSDBankCode}#\nNever 4GET *000*\nTrans Code is ${paymentToken}\nRem last 4 Digits!\n\nDial2Pay *${chosenUSSDBankCode}*000*${paymentToken}#\nExpires in 5mins\n\nCashback\nWin N5k-100m\n\n0 Menu`
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

function displayMyBankUSSDBanks() {
  let response = "CON Select your Bank:\n";
  let bankNames = Object.keys(MYBANKUSSD_BANK_CODES);

  for (let [index, bank] of bankNames.entries()) {
    response += `${++index} ${bank}\n`;
  }
  return response;
}

module.exports = {
  processGiftCashToken,
};
