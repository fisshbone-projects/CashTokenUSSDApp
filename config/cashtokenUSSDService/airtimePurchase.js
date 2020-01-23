const { redisClient } = require("../redisConnectConfig");
const { FelaMarketPlace, App } = require("../index");
const { testNumber } = require("../utils");
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
      response = "END An error occured, please try again later";
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
        response = `END Error! Inputted number is not a valid phone number`;
        resolve(response);
      }
    } else if (brokenDownText.length === 4) {
      let amount = brokenDownText[3];
      await redisClient.hsetAsync(
        `CELDUSSD:${sessionId}`,
        "airtimeAmount",
        `${amount}`
      );
      response = `CON Enter your wallet pin: `;
      resolve(response);
    } else if (brokenDownText.length === 5) {
      let walletPin = brokenDownText[4];
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
      )}\n\n1 Confirm\n2 Cancel`;
      resolve(response);
    } else if (
      brokenDownText.length === 6 &&
      parseInt(brokenDownText[5], 10) === 1
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
      brokenDownText.length === 6 &&
      parseInt(brokenDownText[5], 10) === 2
    ) {
      response = `END Transaction Cancelled.`;
      resolve(response);
    } else {
      response = "END An error occured, please try again.";
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
  axios
    .get(`${FelaMarketPlace.BASE_URL}/list/airtimeProviders`, {
      headers: {
        Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER} `
      }
    })
    .then(response => {
      let airtimeProvidersArray = Object.values(response.data.data);
      airtimeProvidersArray.forEach(async (provider, index) => {
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
      });

      console.log("Done fetching airtimeProviders");

      return Promise.resolve();
    });
}

function processAirtimePurchase(
  sessionId,
  phoneNumber,
  recipentNumber,
  airtimeAmount,
  walletPin,
  providerCode
) {
  return new Promise((resolve, reject) => {
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

    console.log("_______", payload);

    axios
      .post(`${FelaMarketPlace.BASE_URL}/payment/request`, payload, {
        headers: felaHeader
      })
      .then(response => {
        console.log(JSON.stringify(response.data, null, 2));
        // console.log(response)
        resolve(
          `END Dear Customer, your line ${numberToCredit} has been successfully credited with ${NAIRASIGN}${amount} Airtime`
        );
      })
      .catch(error => {
        console.log("error");
        console.log(JSON.stringify(error.response.data, null, 2));
        if (error.response.data.code === 422) {
          resolve(`END Transaction Failed!\nInsufficient user balance`);
        } else {
          resolve(`END Transaction Failed!`);
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
  processAirtime
};
