const { redisClient } = require("$config/redisConnectConfig");
const {
  FelaMarketPlace,
  App,
  LCC: { LCC_PROVIDER_CODE, LCC_TOLL_SERVICE_CODE },
} = require("$config/index");
const {
  APP_PREFIX_REDIS,
  formatNumber,
  MYBANKUSSD_BANK_CODES,
  expireReportsInRedis,
} = require("$utils");
const moment = require("moment");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
const API_DATA_EXPIRE_TIME = parseInt(App.REDIS_API_DATA_EXPIRE);

async function regularBuy(phoneNumber, text, sessionId) {
  return new Promise(async (resolve, reject) => {
    let response = "";
    let brokenDownText = text.split("*");
    let textLength = brokenDownText.length;
    // brokenDownText.unshift("dummyInsert"); //This dummy input helps the code behave as though the LCC service was a sub menu
    // console.log(brokenDownText);
    if (textLength === 3) {
      await redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "lcc_purchase_method",
        "regularBuy"
      );
      response = `CON Enter your LCC account number:`;
    } else if (textLength === 4) {
      //Verify lcc no and ask for amount
      let lccAccountNo = brokenDownText[textLength - 1];
      let confirmLCCNo = await confirmLCCAcountNo(lccAccountNo);

      if (confirmLCCNo) {
        await redisClient.hsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "lccAccountNo",
          `${lccAccountNo}`
        );
        response = `CON Enter amount:`;
      } else {
        response =
          "CON Error!\nEnter a valid LCC account number\n\nEnter 0 Back to home menu";
      }
    } else if (textLength === 5) {
      //save amount and ask for payment method
      let amount = brokenDownText[textLength - 1];
      if (/^[0-9]*$/.test(amount)) {
        if (parseInt(amount) >= 50 && parseInt(amount) <= 100000) {
          await redisClient.hsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "amount",
            `${amount}`
          );
          response = `CON Select payment method:\n1 My Wallet\n2 MyBankUSSD`;
        } else {
          console.log(
            "Amount is less than 50 naira | greater than 100,000 naira"
          );
          response = `CON Error! You can pay between the amount N50 and N100,000 only\n\n0 Menu`;
        }
      } else {
        console.log("Amount inputed is invalid");
        response = `CON Error!\nAmount can only be numbers\n\nEnter 0 Back to home menu`;
      }
    } else if (textLength === 6) {
      let paymentMethod = brokenDownText[textLength - 1];

      if (paymentMethod === "1" || paymentMethod === "2") {
        if (paymentMethod === "1") {
          await redisClient.hsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "paymentMethod",
            "felawallet"
          );
          response = "CON Enter your wallet PIN:";
        } else {
          await redisClient.hsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "paymentMethod",
            "coralpay"
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
        "paymentMethod"
      )) === "felawallet"
    ) {
      let walletPin = brokenDownText[textLength - 1];
      if (/^[0-9]*$/.test(walletPin)) {
        await redisClient.hsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "walletPin",
          `${walletPin}`
        );
        let { lccAccountNo, amount } = await redisClient.hgetallAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`
        );

        response = `CON Confirm LCC Payment:\nLCC AccountNo: ${lccAccountNo}\nAmount: ${formatNumber(
          amount
        )}\nPayMethod: Wallet\n\n1 Confirm\n2 Cancel`;
      } else {
        console.log("PIN is invalid");
        response = `CON Error!\nPIN can only be numbers\n\nEnter 0 Back to home menu`;
      }
    } else if (
      textLength === 7 &&
      Number(brokenDownText[textLength - 1]) <=
        Object.values(MYBANKUSSD_BANK_CODES).length &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      )) === "coralpay"
    ) {
      let { lccAccountNo, amount } = await redisClient.hgetallAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`
      );

      let chosenUSSDBank = Number(brokenDownText[textLength - 1]);
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

      response = `CON Confirm LCC Payment:\nLCC AccountNo: ${lccAccountNo}\nAmount: ${formatNumber(
        amount
      )}\nPayMethod: ${
        chosenUSSDBankName.includes("bank") ||
        chosenUSSDBankName == "GTB" ||
        chosenUSSDBankName == "FBN" ||
        chosenUSSDBankName == "UBA"
          ? chosenUSSDBankName
          : `${chosenUSSDBankName}`
      }\n\n1 Confirm\n2 Cancel`;
    } else if (
      textLength === 8 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      )) === "felawallet"
    ) {
      let userResponse = brokenDownText[textLength - 1];
      if (userResponse === "1") {
        let {
          amount,
          lccAccountNo,
          paymentMethod,
          walletPin,
        } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
        response = await processLCCPayment(
          sessionId,
          phoneNumber,
          lccAccountNo,
          amount,
          paymentMethod,
          walletPin
        );
      } else {
        response = `CON Transaction canceled by user\n\n0 Back to home menu`;
      }
    } else if (
      textLength === 8 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      )) === "coralpay"
    ) {
      let userResponse = brokenDownText[textLength - 1];
      if (userResponse === "1") {
        let {
          amount,
          lccAccountNo,
          paymentMethod,
          chosenUSSDBankCode,
        } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
        response = await processLCCPayment(
          sessionId,
          phoneNumber,
          lccAccountNo,
          amount,
          paymentMethod,
          undefined,
          chosenUSSDBankCode
        );
      } else {
        response = `CON Transaction canceled by user\n\n0 Back to home menu`;
      }
    } else {
      response = `CON Error!\nInvalid response entered\n\nEnter 0 Back to home menu`;
    }

    resolve(response);
  });
}

async function confirmLCCAcountNo(accountNo) {
  return new Promise((resolve) => {
    axios
      .get(
        `${FelaMarketPlace.BASE_URL}/info/tollAccountNo?provider_code=${LCC_PROVIDER_CODE}&account_id=${accountNo}`,
        {
          headers: {
            Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER} `,
          },
        }
      )
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

function processLCCPayment(
  sessionId,
  phoneNumber,
  lccAccountNo,
  amount,
  paymentMethod,
  walletPin = "",
  chosenUSSDBankCode = ""
) {
  return new Promise(async (resolve, reject) => {
    let payload = {
      offeringGroup: "core",
      offeringName: "toll",
      method: `${paymentMethod}`,
      auth: {
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        passkey: `${walletPin}`,
      },
      params: {
        account_number: `${lccAccountNo}`,
        provider_code: `${LCC_PROVIDER_CODE}`,
        service_code: `${LCC_TOLL_SERVICE_CODE}`,
        amount: `${amount}`,
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
      if (paymentMethod === "felawallet") {
        console.log("Success!");
        console.log(response.data);
        await redisClient.incrAsync(
          `${APP_PREFIX_REDIS}:reports:count:purchases_LCCWithWallet:${moment().format(
            "DMMYYYY"
          )}`
        );
        // expireReportsInRedis(
        //   `${APP_PREFIX_REDIS}:reports:count:purchases_LCCWithWallet:${moment().format(
        //     "DMMYYYY"
        //   )}`
        // );
        await redisClient.incrbyAsync(
          `${APP_PREFIX_REDIS}:reports:count:totalValue_LCCWithWallet:${moment().format(
            "DMMYYYY"
          )}`,
          parseInt(amount)
        );
        // expireReportsInRedis(
        //   `${APP_PREFIX_REDIS}:reports:count:totalValue_LCCWithWallet:${moment().format(
        //     "DMMYYYY"
        //   )}`
        // );
        resolve(`END Dear Customer, your payment was successful!`);
      } else {
        console.log("Getting response from coral pay");
        await redisClient.incrAsync(
          `${APP_PREFIX_REDIS}:reports:count:purchases_LCCWithMyBankUSSD:${moment().format(
            "DMMYYYY"
          )}`
        );
        // expireReportsInRedis(
        //   `${APP_PREFIX_REDIS}:reports:count:purchases_LCCWithMyBankUSSD:${moment().format(
        //     "DMMYYYY"
        //   )}`
        // );
        await redisClient.incrbyAsync(
          `${APP_PREFIX_REDIS}:reports:count:totalValue_LCCWithMyBankUSSD:${moment().format(
            "DMMYYYY"
          )}`,
          parseInt(amount)
        );
        // expireReportsInRedis(
        //   `${APP_PREFIX_REDIS}:reports:count:totalValue_LCCWithMyBankUSSD:${moment().format(
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

function displayMyBankUSSDBanks() {
  let response = "CON Select your Bank:\n";
  let bankNames = Object.keys(MYBANKUSSD_BANK_CODES);

  for (let [index, bank] of bankNames.entries()) {
    response += `${++index} ${bank}\n`;
  }
  return response;
}

module.exports = {
  regularBuy,
};
