const { redisClient } = require("../redisConnectConfig");
const { FelaMarketPlace, App } = require("../index");
const { sendSMS } = require("../infoBipConfig");
const {
  testNumber,
  formatNumber,
  MYBANKUSSD_BANK_CODES,
  MYBANKUSSD_BASE_CODE,
  MYBANKUSSD_SERVICE_CODES
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
      response = "CON An error occured, please try again\n\n0 Menu";
      resolve(response);
    }
  });
}

async function airtimeFlow(brokenDownText, phoneNumber, sessionId) {
  return new Promise(async (resolve, reject) => {
    let response = "";

    if (brokenDownText.length === 1) {
      response = await getAirtimeProviders();
      // response = `CON Enter Recipient's Phone Number:`;
      resolve(response);
    } else if (
      brokenDownText.length === 2 &&
      brokenDownText[1] <=
        parseInt(
          await redisClient.zcardAsync(`CELDUSSD:AirtimeProvidersNames`),
          10
        )
    ) {
      await redisClient.hsetAsync(
        `CELDUSSD:${sessionId}`,
        "recipentLine",
        `${brokenDownText[1]}`
      );
      response = `CON Enter Recipient's Phone Number:`;
      resolve(response);
    } else if (brokenDownText.length === 3) {
      let recipentNumber = brokenDownText[2];
      if (testNumber(recipentNumber)) {
        console.log("Number is valid");
        await redisClient.hsetAsync(
          `CELDUSSD:${sessionId}`,
          "recipentNumber",
          `${recipentNumber}`
        );
        response = `CON Enter Amount:`;
        resolve(response);
      } else {
        console.log("Number is invalid");
        response = `CON Error! Inputted number is not a valid phone number\n\n0 Menu`;
        resolve(response);
      }
    } else if (brokenDownText.length === 4) {
      let amount = brokenDownText[3];
      await redisClient.hsetAsync(
        `CELDUSSD:${sessionId}`,
        "airtimeAmount",
        `${amount}`
      );

      response = `CON Select Payment Method:\n1 My CashToken Wallet\n2 MyBankUSSD`;
      resolve(response);
    } else if (
      brokenDownText.length === 5 &&
      parseInt(brokenDownText[4], 10) === 1
    ) {
      console.log("Fulfiling airtime payment through wallet");
      await redisClient.hsetAsync(
        `CELDUSSD:${sessionId}`,
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
        `CELDUSSD:${sessionId}`,
        "airtimePaymentMethod",
        "MyBankUSSD"
      );
      response = displayMyBankUSSDBanks();
      resolve(response);
    } else if (
      brokenDownText.length === 6 &&
      (await redisClient.hgetAsync(
        `CELDUSSD:${sessionId}`,
        "airtimePaymentMethod"
      )) === "wallet"
    ) {
      let walletPin = brokenDownText[5];
      await redisClient.hsetAsync(
        `CELDUSSD:${sessionId}`,
        "walletPin",
        `${walletPin}`
      );
      let {
        airtimeAmount,
        recipentNumber,
        recipentLine
      } = await redisClient.hgetallAsync(`CELDUSSD:${sessionId}`);
      let airtimeProvider = await redisClient.zrangebyscoreAsync(
        `CELDUSSD:AirtimeProvidersNames`,
        recipentLine,
        recipentLine
      );

      response = `CON Confirm your Airtime Purchase:\nRecipient's Line: ${airtimeProvider}\nRecipient's Number: ${recipentNumber}\nAmount: ${NAIRASIGN}${formatNumber(
        airtimeAmount
      )}\nPayment Method: Wallet\n\n1 Confirm\n2 Cancel`;
      resolve(response);
    } else if (
      brokenDownText.length === 6 &&
      parseInt(brokenDownText[5], 10) <=
        Object.values(MYBANKUSSD_BANK_CODES).length &&
      (await redisClient.hgetAsync(
        `CELDUSSD:${sessionId}`,
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
        `CELDUSSD:${sessionId}`,
        "chosenUSSDBankName",
        chosenUSSDBankName,
        "chosenUSSDBankCode",
        chosenUSSDBankCode
      );

      let {
        airtimeAmount,
        recipentNumber,
        recipentLine
      } = await redisClient.hgetallAsync(`CELDUSSD:${sessionId}`);
      let airtimeProvider = await redisClient.zrangebyscoreAsync(
        `CELDUSSD:AirtimeProvidersNames`,
        recipentLine,
        recipentLine
      );

      response = `CON Confirm your Airtime Purchase:\nRecipient's Line: ${airtimeProvider}\nRecipient's Number: ${recipentNumber}\nAmount: ${NAIRASIGN}${formatNumber(
        airtimeAmount
      )}\nPayment Method: ${
        chosenUSSDBankName.includes("bank") ||
        chosenUSSDBankName == "GTB" ||
        chosenUSSDBankName == "FBN"
          ? chosenUSSDBankName
          : `${chosenUSSDBankName} Bank`
      }\n\n1 Confirm\n2 Cancel`;

      resolve(response);
    } else if (
      brokenDownText.length === 7 &&
      parseInt(brokenDownText[6], 10) === 1 &&
      (await redisClient.hgetAsync(
        `CELDUSSD:${sessionId}`,
        "airtimePaymentMethod"
      )) === "wallet"
    ) {
      let {
        airtimeAmount,
        recipentNumber,
        recipentLine,
        walletPin
      } = await redisClient.hgetallAsync(`CELDUSSD:${sessionId}`);
      let providerCode = await redisClient.zrangebyscoreAsync(
        `CELDUSSD:AirtimeProvidersCodes`,
        recipentLine,
        recipentLine
      );
      let response = await processAirtimePurchase(
        sessionId,
        phoneNumber,
        recipentNumber,
        airtimeAmount,
        walletPin,
        providerCode
      );
      resolve(response);
    } else if (
      brokenDownText.length === 7 &&
      parseInt(brokenDownText[6], 10) === 1 &&
      (await redisClient.hgetAsync(
        `CELDUSSD:${sessionId}`,
        "airtimePaymentMethod"
      )) === "MyBankUSSD"
    ) {
      let {
        airtimeAmount,
        recipentNumber,
        chosenUSSDBankCode,
        chosenUSSDBankName
      } = await redisClient.hgetallAsync(`CELDUSSD:${sessionId}`);

      let response = await processAirtimeUSSDString(
        phoneNumber,
        recipentNumber,
        airtimeAmount,
        chosenUSSDBankCode
      );
      resolve(response);
    } else if (
      brokenDownText.length === 7 &&
      parseInt(brokenDownText[6], 10) === 2 &&
      (await redisClient.hgetAsync(
        `CELDUSSD:${sessionId}`,
        "airtimePaymentMethod"
      )) === "wallet"
    ) {
      response = `CON Transaction Cancelled!\n\n0 Menu`;
      resolve(response);
    } else if (
      brokenDownText.length === 7 &&
      parseInt(brokenDownText[6], 10) === 2 &&
      (await redisClient.hgetAsync(
        `CELDUSSD:${sessionId}`,
        "airtimePaymentMethod"
      )) === "MyBankUSSD"
    ) {
      response = `CON Transaction Cancelled!\n\n0 Menu`;
      resolve(response);
    } else {
      response = "CON An error occured, please try again\n\n0 Menu";
      resolve(response);
    }
  });
}

function getAirtimeProviders() {
  return new Promise(resolve => {
    redisClient
      .existsAsync(`CELDUSSD:AirtimeProvidersNames`)
      .then(async resp => {
        let response = "";
        if (resp === 0) {
          await fetchAirtimeProviders();
        }

        let providers = await redisClient.zrangeAsync(
          `CELDUSSD:AirtimeProvidersNames`,
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
  return new Promise(resolve => {
    axios
      .get(`${FelaMarketPlace.BASE_URL}/list/airtimeProviders`, {
        headers: {
          Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER} `
        }
      })
      .then(async response => {
        let airtimeProvidersArray = Object.values(response.data.data);

        for (let [index, provider] of airtimeProvidersArray.entries()) {
          let code = ++index;
          await redisClient.zaddAsync(
            `CELDUSSD:AirtimeProvidersNames`,
            code,
            provider.title
          );
          redisClient.expire(
            `CELDUSSD:AirtimeProvidersNames`,
            API_DATA_EXPIRE_TIME
          );

          await redisClient.zaddAsync(
            `CELDUSSD:AirtimeProvidersCodes`,
            code,
            provider.code
          );
          redisClient.expire(
            `CELDUSSD:AirtimeProvidersCodes`,
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

function processAirtimeUSSDString(
  phoneNumber,
  recipentNumber,
  airtimeAmount,
  chosenUSSDBankCode
) {
  function cleanRecipentNumber(number) {
    let regPhone1 = /^[+]{0,1}(234){1}[0-9]{10}$/;
    let cleanedRecipentNumber = "";
    if (regPhone1.test(number)) {
      if (number.includes("+")) {
        cleanedRecipentNumber = number.slice(4);
        cleanedRecipentNumber = `0${cleanedRecipentNumber}`;
      } else {
        cleanedRecipentNumber = number.slice(3);
        cleanedRecipentNumber = `0${cleanedRecipentNumber}`;
      }
    } else {
      cleanedRecipentNumber = number;
    }

    return cleanedRecipentNumber;
  }

  let prunedRecipentNumber = cleanRecipentNumber(recipentNumber);

  let ussdCode = `*${chosenUSSDBankCode}*${MYBANKUSSD_BASE_CODE}${MYBANKUSSD_SERVICE_CODES.airtime}${prunedRecipentNumber}${airtimeAmount}#`;

  response = `CON This USSD String ${ussdCode} has been sent to you via SMS. Please copy and dial to pay for your airtime.\n\n0 Menu`;

  //Send SMS to user
  smsMessage = `${ussdCode}`;

  sendSMS(phoneNumber, smsMessage);
  return response;
}

function processAirtimePurchase(
  sessionId,
  phoneNumber,
  recipentNumber,
  airtimeAmount,
  walletPin,
  providerCode
) {
  return new Promise(async (resolve, reject) => {
    let payload = {
      offeringGroup: "core",
      offeringName: "airtime",
      method: "felawallet",
      auth: {
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        passkey: `${walletPin}`
      },
      params: {
        recipient: `${recipentNumber}`,
        amount: `${airtimeAmount}`,
        network: `${providerCode}`,
        passkey: `${walletPin}`
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
      console.log(JSON.stringify(response.data, null, 2));
      // console.log(response)
      resolve(
        `CON Dear Customer, your line ${recipentNumber} has been successfully credited with ${NAIRASIGN}${airtimeAmount} Airtime\n\n0 Menu`
      );
    } catch (error) {
      console.log("error");
      console.log(JSON.stringify(error.response.data, null, 2));
      if (error.response.data.code === 422) {
        resolve(`CON Transaction Failed!\nInsufficient user balance\n\n0 Menu`);
      } else {
        resolve(`CON Transaction Failed!\n\n0 Menu`);
      }
    }
  });
}

module.exports = {
  processAirtime
};
