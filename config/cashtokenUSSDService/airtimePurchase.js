const { redisClient } = require("../redisConnectConfig");
const { FelaMarketPlace } = require("../index");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
// const NAIRASIGN = "\u{020A6}";
const NAIRASIGN = "N";

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

function testNumber(phoneNumber) {
  let regPhone1 = /^[+]{0,1}(234){1}[0-9]{10}$/;
  let regPhone2 = /^[0-9]{11}$/;

  let phoneNumberTest =
    regPhone1.test(phoneNumber) || regPhone2.test(phoneNumber);

  return phoneNumberTest;
}

async function airtimeFlow(brokenDownText, phoneNumber, sessionId) {
  return new Promise(async (resolve, reject) => {
    let response = "";
    if (brokenDownText.length === 1) {
      response = `CON Insert Airtel Mobile Number:`;
      resolve(response);
    } else if (brokenDownText.length === 2) {
      let numberToCredit = brokenDownText[1];
      if (testNumber(numberToCredit)) {
        console.log("Number is valid");
        await redisClient.hsetAsync(
          `CELDUSSD:${sessionId}`,
          "numberToCredit",
          `${numberToCredit}`
        );
        response = `CON Insert Amount:`;
        resolve(response);
      } else {
        console.log("Number is invalid");
        response = `END Error! Inputted number is not a valid phone number`;
        resolve(response);
      }
    } else if (brokenDownText.length === 3) {
      let amount = brokenDownText[2];
      await redisClient.hsetAsync(
        `CELDUSSD:${sessionId}`,
        "amount",
        `${amount}`
      );
      response = `CON Enter your wallet pin: `;
      resolve(response);
    } else if (brokenDownText.length === 4) {
      let walletPin = brokenDownText[3];
      await redisClient.hsetAsync(
        `CELDUSSD:${sessionId}`,
        "walletPin",
        `${walletPin}`
      );
      let { amount, numberToCredit } = await redisClient.hgetallAsync(
        `CELDUSSD:${sessionId}`
      );

      response = `CON Please confirm your Airtime Purchase:\nRecipient's Number: ${numberToCredit}\nAmount: ${NAIRASIGN}${formatNumber(
        amount
      )}\n\n1 Confirm\n2 Cancel`;
      resolve(response);
    } else if (
      brokenDownText.length === 5 &&
      parseInt(brokenDownText[4], 10) === 1
    ) {
      let {
        amount,
        numberToCredit,
        walletPin
      } = await redisClient.hgetallAsync(`CELDUSSD:${sessionId}`);
      let response = await processAirtimePurchase(
        sessionId,
        phoneNumber,
        numberToCredit,
        amount,
        walletPin
      );
      resolve(response);
    } else if (
      brokenDownText.length === 5 &&
      parseInt(brokenDownText[4], 10) === 2
    ) {
      response = `END Transaction Cancelled.`;
      resolve(response);
    } else {
      response = "END An error occured, please try again.";
      resolve(response);
    }
  });
}

function processAirtimePurchase(
  sessionId,
  phoneNumber,
  numberToCredit,
  amount,
  walletPin
) {
  return new Promise((resolve, reject) => {
    axios
      .post(
        `${FelaMarketPlace.BASE_URL}/payment/request`,
        {
          offeringGroup: "core",
          offeringName: "airtime",
          method: "felawallet",
          auth: {
            source: `${FelaMarketPlace.THIS_SOURCE}`,
            passkey: `${walletPin}`
          },
          params: {
            recipient: `${numberToCredit}`,
            amount: `${amount}`,
            network: "Airtel",
            passkey: `${walletPin}`
          },
          user: {
            sessionId: `${sessionId}`,
            source: `${FelaMarketPlace.THIS_SOURCE}`,
            sourceId: `${phoneNumber}`,
            phoneNumber: `${phoneNumber}`
          }
        },
        {
          headers: felaHeader
        }
      )
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
