const { redisClient } = require("../redisConnectConfig");
const moment = require("moment");
const { FelaMarketPlace } = require("../index");
const { redeem_wallet } = require("./redeem_wallet");
const { processAirtime } = require("./airtimePurchase");
const { process1KOnlyAirtime } = require("./airtime1KOnlyPurchase");
const { processData } = require("./dataPurchase");
const { servePayBillsRequest } = require("./payBills");
const { processLCC } = require("./LCC");
const { processGiftCashToken } = require("./giftCashToken");
const { checkPinForRepetition, APP_PREFIX_REDIS } = require("../utils");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };

async function CELDUSSD(sessionId, serviceCode, phoneNumber, text) {
  let response = await new Promise(async (resolve, reject) => {
    let walletStatus = await checkCachedWalletStatus(phoneNumber);

    if (walletStatus === null) {
      console.log("Getting walletStatus from ESPI newly ");
      let { status } = await checkWalletStatus(phoneNumber);
      walletStatus = status;
      if (status === "active") {
        redisClient.sadd(`${APP_PREFIX_REDIS}:activeWallets`, `${phoneNumber}`);
      } else if (status === "inactive") {
        redisClient.setex(
          `${APP_PREFIX_REDIS}:${phoneNumber}:inactive`,
          600,
          "inactive"
        );
      }
      // await redisClient.hset(
      //   `${APP_PREFIX_REDIS}:userWalletStatus`,
      //   `${phoneNumber}`,
      //   `${status}`
      // );
    } else {
      console.log("We got walletStatus from cached record");
    }

    redisClient
      .existsAsync(`${APP_PREFIX_REDIS}:${sessionId}`)
      .then(async resp => {
        if (resp === 0) {
          console.log("Creating new user session");

          let newDate = new Date();
          console.log(
            `New Hit: ${sessionId} at ${newDate.toDateString()} ${newDate
              .toTimeString()
              .substring(0, 8)}`
          );

          console.log(`Wallet Status for ${phoneNumber}: ${walletStatus}`);

          if (walletStatus === "inactive") {
            redisClient
              .hsetAsync(
                `${APP_PREFIX_REDIS}:${sessionId}`,
                "walletStatus",
                "inactive"
              )
              .then(() => {
                redisClient.expire(`${APP_PREFIX_REDIS}:${sessionId}`, 420); //Save the sessionID Temp details for 7 minutes
              });
            let response = await ActivateUser(phoneNumber, text, sessionId);
            resolve(response);
          } else if (walletStatus === "active") {
            redisClient
              .hmsetAsync(
                `${APP_PREFIX_REDIS}:${sessionId}`,
                "walletStatus",
                "active"
              )
              .then(() => {
                redisClient.expire(`${APP_PREFIX_REDIS}:${sessionId}`, 420); //Save the sessionID Temp details for 7 minutes
              });

            let response = await NormalFlow(phoneNumber, text, sessionId);
            resolve(response);
          } else {
            let response = `END Welcome to MyBankUSSD\nSorry, our service is temporarily unavailable.\nPlease try again.`;

            await redisClient.hdel(
              `${APP_PREFIX_REDIS}:userWalletStatus`,
              `${phoneNumber}`
            );

            resolve(response);
          }
        } else if (resp === 1) {
          console.log("Continuing an established session");
          redisClient
            .hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`)
            .then(async ({ walletStatus: savedWalletStatus }) => {
              console.log(
                `Continuing establised session with user ${savedWalletStatus}`
              );
              if (savedWalletStatus === "inactive") {
                let response = await ActivateUser(phoneNumber, text, sessionId);
                resolve(response);
              } else if (savedWalletStatus === "active") {
                let response = await NormalFlow(phoneNumber, text, sessionId);
                resolve(response);
              }
            });
        }
      })
      .catch(err => {
        console.log(err);
      });
  });

  await redisClient.incrAsync(
    `${APP_PREFIX_REDIS}:reports:count:global_totalTransactionalHits:${moment().format(
      "DMMYYYY"
    )}`
  );
  await redisClient.saddAsync(
    `${APP_PREFIX_REDIS}:reports:set:global_totalVisitors:${moment().format(
      "DMMYYYY"
    )}`,
    phoneNumber
  );
  await redisClient.saddAsync(
    `${APP_PREFIX_REDIS}:reports:set:global_totalSessions:${moment().format(
      "DMMYYYY"
    )}`,
    sessionId
  );

  return response;
}

async function ActivateUser(phoneNumber, text, sessionId) {
  console.log("Activation flow in process");
  return new Promise(async (resolve, reject) => {
    let response = "";
    let brokenDownText = text !== "" ? text.split("*") : [];

    if (text === "") {
      await redisClient.incrAsync(
        `${APP_PREFIX_REDIS}:reports:count:topMenu_ActivationScreen:${moment().format(
          "DMMYYYY"
        )}`
      );
      response = `CON MyBankUSSD\nWelcome, your CashToken wallet is not yet activated.\nGenerate your wallet PIN (Min 4 digit):`;
      resolve(response);
    } else if (brokenDownText.length === 1) {
      await redisClient.hsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "registeredPin",
        `${brokenDownText[0]}`
      );
      response = `CON Confirm your PIN:`;
      resolve(response);
    } else if (brokenDownText.length === 2) {
      let { registeredPin } = await redisClient.hgetallAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`
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
            response = `CON Repeated digit PINs are not allowed (e.g 1111).\nUse a different pattern of PIN\n\nEnter 0 to start over`;
            resolve(response);
          } else {
            console.log("PIN not between 4 to 12 digits");
            response = `CON Your PIN can only be 4 to 12 digits long\n\nEnter 0 to start over`;
            resolve(response);
          }
        } else {
          console.log("PIN containing non-digits");
          response = `CON Your PIN can only be numbers\n\nEnter 0 to start over`;
          resolve(response);
        }
      } else {
        console.log("PIN not matching");
        response = "CON Your PIN does not match\n\nEnter 0 to start over";
        resolve(response);
      }
    } else {
      console.log("User entered wrong response");
      response = "CON Invalid response inputed\n\nEnter 0 Back to home menu";
      resolve(response);
    }
  });
}

async function NormalFlow(phoneNumber, text, sessionId) {
  console.log("Normal flow in process");
  let response = await new Promise(async (resolve, reject) => {
    let response = "";
    if (text === "") {
      console.log("Welcome page");

      response = `CON MyBankUSSD\nCashTokenRewards\n\n1 Redeem/Wallet\n2 Airtime\n3 Airtime (N1000)\n4 PayBills\n5 LCC\n6 GiftCashToken\n7 BorrowPower\n\nWin up to  5K-100M Weekly`;
      resolve(response);
    } else if (text.startsWith("1")) {
      response = await redeem_wallet(text, phoneNumber, sessionId);
      resolve(response);
    } else if (text.startsWith("2")) {
      response = await processAirtime(text, phoneNumber, sessionId);
      resolve(response);
    } else if (text.startsWith("3")) {
      response = await process1KOnlyAirtime(text, phoneNumber, sessionId);
      resolve(response);
    } else if (text.startsWith("4")) {
      // response = await processFundDisbursement(text, phoneNumber, sessionId);
      // resolve(response);

      // response = `CON Welcome!!!\nThis service is still under development, but please check back soon, we are always ready to serve you.\n\n0 Menu`;
      response = servePayBillsRequest(phoneNumber, text, sessionId);
      resolve(response);
    } else if (text.startsWith("5")) {
      response = await processLCC(phoneNumber, text, sessionId);
      resolve(response);
    } else if (text.startsWith("6")) {
      response = await processGiftCashToken(phoneNumber, text, sessionId);
      resolve(response);
    } else if (text === "7") {
      await redisClient.incrAsync(
        `${APP_PREFIX_REDIS}:reports:count:topMenu_BorrowPower:${moment().format(
          "DMMYYYY"
        )}`
      );
      response = `CON Welcome!!!\nThis service is still under development, but please check back soon, we are always ready to serve you.\n\n0 Menu`;
      resolve(response);
    } else {
      response = "CON Input a valid service option\nEnter 0 Back to home menu";
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
          .hmsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "walletStatus",
            "active"
          )
          .then(async () => {
            await redisClient.sadd(
              `${APP_PREFIX_REDIS}:activeWallets`,
              `${phoneNumber}`
            );
            await redisClient.incrAsync(
              `${APP_PREFIX_REDIS}:reports:count:global_activatedUsers:${moment().format(
                "DMMYYYY"
              )}`
            );
            await redisClient.saddAsync(
              `${APP_PREFIX_REDIS}:reports:set:global_activatedUsers:${moment().format(
                "DMMYYYY"
              )}`,
              phoneNumber
            );
            redisClient.expire(`${APP_PREFIX_REDIS}:${sessionId}`, 300);
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

async function checkCachedWalletStatus(phoneNumber) {
  return new Promise(async resolve => {
    let isActive = await redisClient.sismemberAsync(
      `${APP_PREFIX_REDIS}:activeWallets`,
      `${phoneNumber}`
    );

    let isInActive = await redisClient.existsAsync(
      `${APP_PREFIX_REDIS}:${phoneNumber}:inactive`
    );

    if (isActive === 1) {
      resolve("active");
    } else if (isInActive === 1) {
      resolve("inactive");
    } else {
      resolve(null);
    }
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
          status: response.data.data.status
        });
      })
      .catch(e => {
        // console.log(e);
        if (e.response) {
          if (e.response.status === 404) {
            if (e.response.data) {
              console.log(e.response.data);
            }
            console.log("Response about user: User not profiled");
            resolve({ status: "inactive" });
          } else {
            console.log("Could not get response from ESPI");
            console.log(e);
            resolve({ status: "returnError" });
          }
        } else {
          console.log("Could not get response from ESPI");
          console.log(e);
          resolve({ status: "returnError" });
        }
      });
  });
}

module.exports = {
  CELDUSSD
};
