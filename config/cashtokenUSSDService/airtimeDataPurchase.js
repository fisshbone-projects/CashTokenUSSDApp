const { redisClient } = require("../redisConnectConfig");
const { FelaMarketPlace } = require("../index");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };

async function processAirtimeData(text, phoneNumber, sessionId) {
  return new Promise(async (resolve, reject) => {
    console.log("Starting Airtime/Data Purchase Process");
    let response = "";
    if (text === "2*2") {
      response = `CON 1. Purchase Airtime\n2. Purchase Data`;
      resolve(response);
    } else if (text.startsWith("2*2*1")) {
      let brokenDownText = text.split("*");
      response = await airtimeFlow(brokenDownText, phoneNumber, sessionId);
      resolve(response);
    } else if (text.startsWith("2*2*2")) {
      let brokenDownText = text.split("*");
      response = await dataFlow(brokenDownText, phoneNumber, sessionId);
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
    if (brokenDownText.length === 3) {
      response = `CON Enter the phone number to credit:`;
      resolve(response);
    } else if (brokenDownText.length === 4) {
      let numberToCredit = brokenDownText[3];
      if (testNumber(numberToCredit)) {
        console.log("Number is valid");
        await redisClient.hsetAsync(
          `CELDUSSD:${sessionId}`,
          "numberToCredit",
          `${numberToCredit}`
        );
        response = `CON Enter the amount you want to purchase:`;
        resolve(response);
      } else {
        console.log("Number is invalid");
        response = `END Error! Inputted number is not a valid phone number`;
        resolve(response);
      }
    } else if (brokenDownText.length === 5) {
      let amount = brokenDownText[4];
      await redisClient.hsetAsync(
        `CELDUSSD:${sessionId}`,
        "amount",
        `${amount}`
      );
      response = `CON Enter your wallet pin: `;
      resolve(response);
    } else if (brokenDownText.length === 6) {
      let walletPin = brokenDownText[5];
      await redisClient.hsetAsync(
        `CELDUSSD:${sessionId}`,
        "walletPin",
        `${walletPin}`
      );
      let { amount, numberToCredit } = await redisClient.hgetallAsync(
        `CELDUSSD:${sessionId}`
      );

      response = `CON Please confirm your Airtime Purchase:\nRecipient's Number: ${numberToCredit}\nAmount: ${amount}\n\n1. Confirm\n2. Cancel`;
      resolve(response);
    } else if (
      brokenDownText.length === 7 &&
      parseInt(brokenDownText[6], 10) === 1
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
      brokenDownText.length === 7 &&
      parseInt(brokenDownText[6], 10) === 2
    ) {
      response = `END Transaction Cancelled.`;
      resolve(response);
    } else {
      response = "END An error occured, please try again.";
      resolve(response);
    }
  });
}

async function dataFlow(brokenDownText, phoneNumber, sessionId) {
  return new Promise(async (resolve, reject) => {
    let response = "";
    if (brokenDownText.length === 3) {
      response = `CON Enter the phone number to credit:`;
      resolve(response);
    } else if (brokenDownText.length === 4) {
      let numberToCredit = brokenDownText[3];
      if (testNumber(numberToCredit)) {
        console.log("Number is valid");
        await redisClient.hsetAsync(
          `CELDUSSD:${sessionId}`,
          "numberToCredit",
          `${numberToCredit}`
        );

        redisClient
          .existsAsync(`CELDUSSD:AirtelDataBundleNames`)
          .then(async resp => {
            if (resp === 0) {
              await getAirtelDataPlans();
            }
            let dataBundles = await redisClient.zrangeAsync(
              `CELDUSSD:AirtelDataBundleNames`,
              0,
              6,
              "withscores"
            );
            let { bundleNames, bundlePrices } = extractBundleNameAndPrice(
              dataBundles
            );
            console.log("Get: ", bundleNames);
            console.log("Get: ", bundlePrices);
            response = `CON Select your desired dataplan:\n1. N${
              bundlePrices[0]
            }/${bundleNames[0]}\n2. N${bundlePrices[1]}/${
              bundleNames[1]
            }\n3. N${bundlePrices[2]}/${bundleNames[2]}\n4. N${
              bundlePrices[3]
            }/${bundleNames[3]}\n5. N${bundlePrices[4]}/${
              bundleNames[4]
            }\n6. N${bundlePrices[5]}/${bundleNames[5]}\n7. N${
              bundlePrices[6]
            }/${bundleNames[6]}\n8. Next to see more data deals`;
            resolve(response);
          });
      } else {
        console.log("Number is invalid");
        response = `END Error! Inputted number is not a valid phone number`;
        resolve(response);
      }
    } else if (
      brokenDownText.length === 5 &&
      parseInt(brokenDownText[4], 10) <= 7
    ) {
      let selectedDataPlan = brokenDownText[4];
      await saveSelectedDataPlanDetails(selectedDataPlan, sessionId, "first");
      response = `CON Enter your wallet PIN:`;
      resolve(response);
    } else if (
      brokenDownText.length === 5 &&
      parseInt(brokenDownText[4], 10) == 8
    ) {
      redisClient
        .existsAsync(`CELDUSSD:AirtelDataBundleNames`)
        .then(async resp => {
          if (resp === 0) {
            await getAirtelDataPlans();
          }
          let dataBundles = await redisClient.zrangeAsync(
            `CELDUSSD:AirtelDataBundleNames`,
            7,
            13,
            "withscores"
          );
          let { bundleNames, bundlePrices } = extractBundleNameAndPrice(
            dataBundles
          );
          console.log("Get: ", bundleNames);
          console.log("Get: ", bundlePrices);
          response = `CON Select your desired dataplan:\n1. N${
            bundlePrices[0]
          }/${bundleNames[0]}\n2. N${bundlePrices[1]}/${bundleNames[1]}\n3. N${
            bundlePrices[2]
          }/${bundleNames[2]}\n4. N${bundlePrices[3]}/${bundleNames[3]}\n5. N${
            bundlePrices[4]
          }/${bundleNames[4]}\n6. N${bundlePrices[5]}/${bundleNames[5]}\n7. N${
            bundlePrices[6]
          }/${bundleNames[6]}`;
          resolve(response);
        });
    } else if (
      brokenDownText.length === 6 &&
      parseInt(brokenDownText[5], 10) <= 7
    ) {
      let selectedDataPlan = brokenDownText[5];
      await saveSelectedDataPlanDetails(selectedDataPlan, sessionId, "second");
      response = `CON Enter your wallet PIN:`;
      resolve(response);
    } else if (brokenDownText.length === 6 && brokenDownText[5].length >= 4) {
      await redisClient.hsetAsync(
        `CELDUSSD:${sessionId}`,
        "walletPin",
        `${brokenDownText[5]}`
      );

      response = await displayDataPlanPurchaseSummary(sessionId);
      resolve(response);
    } else if (brokenDownText.length === 7 && brokenDownText[6].length >= 4) {
      await redisClient.hsetAsync(
        `CELDUSSD:${sessionId}`,
        "walletPin",
        `${brokenDownText[6]}`
      );

      response = await displayDataPlanPurchaseSummary(sessionId);
      resolve(response);
    } else if (
      brokenDownText.length === 7 &&
      parseInt(brokenDownText[6], 10) === 1
    ) {
      let {
        numberToCredit,
        dataPlanCode,
        walletPin
      } = await redisClient.hgetallAsync(`CELDUSSD:${sessionId}`);
      let response = await processDataPurchase(
        sessionId,
        phoneNumber,
        numberToCredit,
        dataPlanCode,
        walletPin
      );
      resolve(response);
    } else if (
      brokenDownText.length === 7 &&
      parseInt(brokenDownText[6], 10) === 2
    ) {
      response = `END Transaction Cancelled!`;
      resolve(response);
    } else if (
      brokenDownText.length === 8 &&
      parseInt(brokenDownText[7], 10) === 1
    ) {
      let {
        numberToCredit,
        dataPlanCode,
        walletPin
      } = await redisClient.hgetallAsync(`CELDUSSD:${sessionId}`);
      let response = await processDataPurchase(
        sessionId,
        phoneNumber,
        numberToCredit,
        dataPlanCode,
        walletPin
      );
      resolve(response);
    } else if (
      brokenDownText.length === 8 &&
      parseInt(brokenDownText[7], 10) === 2
    ) {
      response = `END Transaction Cancelled!`;
      resolve(response);
    } else {
      response = "END An error occured, please try again.";
      resolve(response);
    }
  });
}

async function getAirtelDataPlans() {
  return new Promise((resolve, reject) => {
    axios
      .get(`https://api.myfela.ng/list/dataBundles?provider_code=Airtel`, {
        headers: {
          Authorization: `Bearer 04a7e2df-6821-4c64-a88b-1ff28a6ccc6c`
        }
      })
      .then(response => {
        // console.log(JSON.stringify(response.data, null, 2));
        let dataBundleArray = Object.values(response.data.data);
        console.log(dataBundleArray.length);
        dataBundleArray.forEach(async bundle => {
          await redisClient.zaddAsync(
            `CELDUSSD:AirtelDataBundleNames`,
            bundle.price,
            bundle.title
          );
          redisClient.expire(`CELDUSSD:AirtelDataBundleNames`, 1800);
          await redisClient.zaddAsync(
            `CELDUSSD:AirtelDataBundleCodes`,
            bundle.price,
            bundle.code
          );
          redisClient.expire(`CELDUSSD:AirtelDataBundleCodes`, 1800);
          resolve();
        });
      })
      .catch(error => {
        console.log("error");
        console.log(JSON.stringify(error.response.data, null, 2));
      });
  });
}

function extractBundleNameAndPrice(dataBundles) {
  let bundleNames = dataBundles.filter(value => {
    return value.startsWith("Airtel Data");
  });
  let extractedBundleNames = [];
  bundleNames.forEach(value => {
    let name = value.split("-");
    if (name.length === 2) {
      extractedBundleNames.push(name[1]);
    } else if (name.length === 3) {
      extractedBundleNames.push(name[2]);
    }
  });

  let bundlePrices = dataBundles.filter(value => {
    return !value.startsWith("Airtel Data");
  });
  return { bundleNames: extractedBundleNames, bundlePrices: bundlePrices };
}

function displayDataPlanPurchaseSummary(sessionId) {
  return new Promise(async (resolve, reject) => {
    let {
      numberToCredit,
      dataPlanName,
      dataPlanPrice
    } = await redisClient.hgetallAsync(`CELDUSSD:${sessionId}`);

    let response = `CON Please confirm your DataPlan Purchase:\nRecipient's Number: ${numberToCredit}\nDataPlan: ${dataPlanName}\nPrice: N${dataPlanPrice}\n\n1. Confirm\n 2. Cancel`;
    resolve(response);
  });
}

function saveSelectedDataPlanDetails(selectedDataPlan, sessionId, iteration) {
  return new Promise(async (resolve, reject) => {
    redisClient
      .existsAsync(`CELDUSSD:AirtelDataBundleNames`)
      .then(async resp => {
        if (resp === 0) {
          await getAirtelDataPlans();
        }
        let chosenData = "";
        if (iteration === "first") {
          chosenData = parseInt(selectedDataPlan, 10);
          chosenData -= 1;
        } else if (iteration === "second") {
          chosenData = parseInt(selectedDataPlan, 10);
          chosenData += 6;
        }
        let dataPlanCode = await redisClient.zrangeAsync(
          `CELDUSSD:AirtelDataBundleCodes`,
          chosenData,
          chosenData
        );
        let dataPlanName = await redisClient.zrangeAsync(
          `CELDUSSD:AirtelDataBundleNames`,
          chosenData,
          chosenData,
          "withscores"
        );
        console.log(dataPlanName);
        let {
          bundleNames: extractedDataPlanName,
          bundlePrices: extractedDataPlanPrice
        } = extractBundleNameAndPrice(dataPlanName);
        console.log(
          dataPlanCode,
          extractedDataPlanName,
          extractedDataPlanPrice
        );
        await redisClient.hmsetAsync(
          `CELDUSSD:${sessionId}`,
          "dataPlanCode",
          dataPlanCode[0],
          "dataPlanName",
          extractedDataPlanName[0],
          "dataPlanPrice",
          extractedDataPlanPrice[0]
        );
        resolve();
      });
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
          method: "online",
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
        resolve(`END Transaction Successful!`);
      })
      .catch(error => {
        console.log("error");
        console.log(JSON.stringify(error.response.data, null, 2));
        resolve(`END Transaction Failed!`);
      });
  });
}

function processDataPurchase(
  sessionId,
  phoneNumber,
  numberToCredit,
  dataPlanCode,
  walletPin
) {
  return new Promise((resolve, reject) => {
    axios
      .post(
        `${FelaMarketPlace.BASE_URL}/payment/request`,
        {
          offeringGroup: "core",
          offeringName: "databundle",
          method: "felawallet",
          auth: {
            source: `${FelaMarketPlace.THIS_SOURCE}`,
            passkey: `${walletPin}`
          },
          params: {
            account_id: `${numberToCredit}`,
            bundle_code: `${dataPlanCode}`,
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
        resolve(`END Transaction Successful!`);
      })
      .catch(error => {
        console.log("error");
        console.log(JSON.stringify(error.response.data, null, 2));
        resolve(`END Transaction Failed!`);
      });
  });
}

module.exports = {
  processAirtimeData
};
