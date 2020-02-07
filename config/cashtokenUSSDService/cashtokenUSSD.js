const { redisClient } = require("../redisConnectConfig");
const { FelaMarketPlace } = require("../index");
const { processFundDisbursement } = require("./walletCashout");
const { processAirtime } = require("./airtimePurchase");
const { processData } = require("./dataPurchase");
const { resetPin } = require("./resetPin");
const { checkPinForRepetition } = require("../utils");
// const { processElectricity } = require("./electricityPayment");
const {
  getUsersCashtoken,
  getUsersWalletDetails
} = require("./cashtokenWallet");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };

async function CELDUSSD(sessionId, serviceCode, phoneNumber, text) {
  let response = await new Promise((resolve, reject) => {
    redisClient
      .existsAsync(`CELDUSSD:${sessionId}`)
      .then(async resp => {
        if (resp === 0) {
          console.log("Creating new user session");
          let {
            name: walletHoldername,
            status: walletStatus
          } = await checkWalletStatus(phoneNumber);

          let newDate = new Date();
          console.log(
            `New Hit: ${sessionId} at ${newDate.toDateString()} ${newDate
              .toTimeString()
              .substring(0, 8)}`
          );

          console.log(`Wallet Status for ${phoneNumber}: ${walletStatus}`);
          if (
            walletHoldername !== undefined &&
            walletHoldername !== null &&
            walletHoldername.length > 0
          ) {
            await redisClient.hsetAsync(
              `CELDUSSD:${sessionId}`,
              "walletHoldername",
              walletHoldername
            );
          } else {
            await redisClient.hsetAsync(
              `CELDUSSD:${sessionId}`,
              "walletHoldername",
              "undefined"
            );
            walletHoldername = undefined;
          }

          if (walletStatus !== "active") {
            redisClient
              .hsetAsync(`CELDUSSD:${sessionId}`, "walletStatus", "inactive")
              .then(() => {
                redisClient.expire(`CELDUSSD:${sessionId}`, 300);
              });
            let response = await ActivateUser(phoneNumber, text, sessionId);
            resolve(response);
          } else if (walletStatus === "active") {
            redisClient
              .hmsetAsync(`CELDUSSD:${sessionId}`, "walletStatus", "active")
              .then(() => {
                redisClient.expire(`CELDUSSD:${sessionId}`, 300);
              });

            let response = await NormalFlow(
              phoneNumber,
              text,
              walletHoldername,
              sessionId
            );
            resolve(response);
          }
        } else if (resp === 1) {
          console.log("Continuing an established session");
          redisClient
            .hgetallAsync(`CELDUSSD:${sessionId}`)
            .then(async ({ walletStatus, walletHoldername }) => {
              console.log(
                `Continuing establised session with user ${walletStatus}`
              );
              if (walletStatus === "inactive") {
                let response = await ActivateUser(phoneNumber, text, sessionId);
                resolve(response);
              } else if (walletStatus === "active") {
                let response = await NormalFlow(
                  phoneNumber,
                  text,
                  walletHoldername !== "undefined"
                    ? walletHoldername
                    : undefined,
                  sessionId
                );
                resolve(response);
              }
            });
        }
      })
      .catch(err => {
        console.log(err);
      });
  });
  return response;
}

async function ActivateUser(phoneNumber, text, sessionId) {
  console.log("Activation flow in process");
  return new Promise(async (resolve, reject) => {
    let response = "";
    let brokenDownText = text !== "" ? text.split("*") : [];

    if (text === "") {
      response = `CON Welcome, your CashToken wallet is not yet activated.\nGenerate your wallet PIN (Min 4 digit):`;
      resolve(response);
    } else if (brokenDownText.length === 1) {
      await redisClient.hsetAsync(
        `CELDUSSD:${sessionId}`,
        "registeredPin",
        `${brokenDownText[0]}`
      );
      response = `CON Confirm your PIN:`;
      resolve(response);
    } else if (brokenDownText.length === 2) {
      let { registeredPin } = await redisClient.hgetallAsync(
        `CELDUSSD:${sessionId}`
      );

      if (brokenDownText[1] === registeredPin) {
        if (registeredPin.match(/^[0-9]+$/)) {
          let isPinRepeating = checkPinForRepetition(registeredPin);

          if (
            registeredPin.length >= 4 &&
            registeredPin.length <= 12 &&
            !isPinRepeating
          ) {
            console.log("PIN confirmed successful, going on to activate user");
            response = await activateWalletCall(
              sessionId,
              phoneNumber,
              registeredPin
            );
            resolve(response);
          } else if (isPinRepeating) {
            console.log("PIN is repeating i.e PIN is of type 1111");
            response = `CON Repeated digit PINs are not allowed (e.g 1111).\nPlease use a different pattern of PIN\n\n0 Menu`;
            resolve(response);
          } else {
            console.log("PIN not between 4 to 12 digits");
            response = `CON Your PIN can only be 4 to 12 digits long\n\n0 Menu`;
            resolve(response);
          }
        } else {
          console.log("PIN containing non-digits");
          response = `CON Your PIN can only be numbers\n\n0 Menu`;
          resolve(response);
        }
      } else {
        console.log("PIN not matching");
        response = "CON Your PIN does not match\n\n0 Menu";
        resolve(response);
      }
    }
  });
}

async function NormalFlow(phoneNumber, text, walletHoldername, sessionId) {
  console.log("Normal flow in process");
  let response = await new Promise(async (resolve, reject) => {
    let response = "";
    if (text === "") {
      console.log("Welcome page");
      response = `CON MyBankUSSD\nCashTokenRewards\n\n1 Redeem/Wallet\n2 Airtime\n3 Airtime (N1000)\n4 PayBills\n5 LCC\n6 GiftCashToken\n7 BorrowPower\n\nWin up to  5K-100M Weekly`;
      // response = `CON Welcome to myBankUSSD CashToken Rewards\n1 CashToken Wallet\n2 Buy Airtime\n3 Buy Data\n4 Redeem Cash\n5 Reset Wallet PIN\n6 Gift CashToken\n\nInstant Cash-Back\nWin 5K-100M Weekly`;
      // response = `CON Welcome ${
      //   walletHoldername === undefined || walletHoldername === ""
      //     ? phoneNumber
      //     : walletHoldername
      // } to myBankUSSD\n1 CashToken Wallet\n2 Buy Airtime\n3 Buy Data\n4 Redeem Cash\n5 Reset Wallet PIN\n6 Gift CashToken`;
      resolve(response);
    } else if (text === "1") {
      response = await getUsersWalletDetails(phoneNumber);
      resolve(response);
    } else if (text.startsWith("2")) {
      response = await processAirtime(text, phoneNumber, sessionId);
      resolve(response);
    } else if (text.startsWith("3")) {
      response = await processData(text, phoneNumber, sessionId);
      resolve(response);
    } else if (text.startsWith("4")) {
      response = await processFundDisbursement(text, phoneNumber, sessionId);
      resolve(response);
      // response = await processElectricity(text, phoneNumber, sessionId);
      // resolve(response);
    } else if (text.startsWith("5")) {
      response = await resetPin(text, phoneNumber, sessionId);
      resolve(response);
    } else if (text === "6") {
      response = `CON Welcome!!!\nThis service is still under development, but please check back soon, we are always ready to serve you.\n\n0 Menu`;
      resolve(response);
    } else {
      response = "CON Input a valid service option\n0 Main Menu";
      resolve(response);
    }
  });
  return response;
}

async function activateWalletCall(sessionId, phoneNumber, walletPin) {
  return new Promise(async (resolve, reject) => {
    let payload = {
      offeringGroup: "felawallet",
      offeringName: "profile",
      auth: {
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        passkey: `${walletPin}`
      },
      params: {
        operation: "approve"
        // name: `${userName}`
      },
      user: {
        sessionId: `${sessionId}`,
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        sourceId: `${phoneNumber}`,
        phoneNumber: `${phoneNumber}`
      }
    };
    console.log(payload);
    axios
      .post(`${FelaMarketPlace.BASE_URL}/offering/fulfil`, payload, {
        headers: felaHeader
      })
      .then(resp => {
        console.log(resp);
        redisClient
          .hmsetAsync(`CELDUSSD:${sessionId}`, "walletStatus", "active")
          .then(() => {
            redisClient.expire(`CELDUSSD:${sessionId}`, 300);
          });
        let feedback = `CON Wallet Activation Successful!\nInput 0 or redial *347*999# to start enjoying lifechanging CashToken opportunies`;
        resolve(feedback);
      })
      .catch(resp => {
        console.log(resp);
        let feedback = `END Wallet Activation Failed!\nPlease try again`;
        resolve(feedback);
      });
  });
}

async function checkWalletStatus(phoneNumber) {
  return new Promise((resolve, reject) => {
    axios
      .get(
        `${FelaMarketPlace.BASE_URL}/info/felaWallet?accountId=${phoneNumber}`,
        {
          headers: felaHeader
        }
      )
      .then(async response => {
        console.log(JSON.stringify(response.data, null, 2));
        resolve({
          status: response.data.data.status,
          name: response.data.data.name
        });
      })
      .catch(e => {
        console.log(e);
        // console.log(e.response.data);
        resolve({ status: "inactive" });
      });
  });
}

module.exports = {
  CELDUSSD
};
