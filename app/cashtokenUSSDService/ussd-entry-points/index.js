const { redisClient } = require("$config/redisConnectConfig");
const mongoFront = require("$mongoLibs/mongoFront");
const moment = require("moment");
const { FelaMarketPlace } = require("$config/index");
const { redeem_wallet, rewardTarget } = require("../wallet-service");
const {
  processAirtime,
  processData,
  processGiftCashToken,
  servePayBillsRequest,
} = require("../vas-services");
const { quickServeService } = require("../quickServeService");
const {
  checkPinForRepetition,
  APP_PREFIX_REDIS,
  expireReportsInRedis,
} = require("$utils");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };

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
      // expireReportsInRedis(
      //   `${APP_PREFIX_REDIS}:reports:count:topMenu_ActivationScreen:${moment().format(
      //     "DMMYYYY"
      //   )}`
      // );
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

const MAINMENU_1 = `CON MyBankUSSD\nBuy&Win 5K-100M\n\n1 QuickServe\n2 Cashout\n3 GiftCashToken\n4 Airtime\n5 Data\n6 PayBills\n7 Borrow\n8 PayMerchant\n9 Next\n\nCashTokenRewards`;

const MAINMENU_2 = `CON MyBankUSSD\nBuy&Win 5K-100M\n\n1 RewardTarget\n2 BVN\n3 Emergency\n4 Help\n0 Back\n\nCashTokenRewards`;

function NormalFlow(phoneNumber, text, sessionId) {
  console.log("Normal flow in process");
  return new Promise(async (resolve, reject) => {
    let response = "";
    if (text === "") {
      console.log("Welcome page");

      response = MAINMENU_1;
    } else if (text.startsWith("1")) {
      // response = await quickServeService(text, phoneNumber, sessionId);
      response =
        "CON QuickServe is an exciting new feature we are working on.\n Please stay connected\n\n0 Main menu";
    } else if (text.startsWith("2")) {
      response = await redeem_wallet(text, phoneNumber, sessionId);
    } else if (text.startsWith("3")) {
      response = await processGiftCashToken(phoneNumber, text, sessionId);
    } else if (text.startsWith("4")) {
      response = await processAirtime(text, phoneNumber, sessionId);
      // response = await process1KOnlyAirtime(text, phoneNumber, sessionId);
    } else if (text.startsWith("5")) {
      response = processData(text, phoneNumber, sessionId);
    } else if (text.startsWith("6")) {
      response = servePayBillsRequest(phoneNumber, text, sessionId);
    } else if (text.startsWith("7")) {
      await redisClient.incrAsync(
        `${APP_PREFIX_REDIS}:reports:count:topMenu_BorrowPower:${moment().format(
          "DMMYYYY"
        )}`
      );
      // expireReportsInRedis(
      //   `${APP_PREFIX_REDIS}:reports:count:topMenu_BorrowPower:${moment().format(
      //     "DMMYYYY"
      //   )}`
      // );
      response = `CON Welcome!!!\nThis service is still under development, but please check back soon, we are always ready to serve you.\n\n0 Main menu`;
    } else if (text === "8") {
      response = `CON Welcome!!!\nThis service is still under development, but please check back soon, we are always ready to serve you.\n\n0 Main menu`;
    } else if (text.startsWith("9")) {
      if (text === "9") {
        response = MAINMENU_2;
      } else if (text === "9*1") {
        response = await rewardTarget();
      } else if (text === "9*2") {
        response = `CON Welcome!!!\nThis service is still under development, but please check back soon, we are always ready to serve you.\n\n0 Main menu`;
      } else if (text === "9*3") {
        response = `CON Welcome!!!\nThis service is still under development, but please check back soon, we are always ready to serve you.\n\n0 Main menu`;
      } else if (text === "9*4") {
        response = `CON Welcome!!!\nThis service is still under development, but please check back soon, we are always ready to serve you.\n\n0 Main menu`;
      } else {
        response =
          "CON Input a valid service option\nEnter 0 to go back to home menu";
      }
    } else {
      response =
        "CON Input a valid service option\nEnter 0 to go back to home menu";
    }
    resolve(response);
  });
}

async function activateWalletCall(sessionId, phoneNumber, walletPin) {
  return new Promise(async (resolve, reject) => {
    let payload = {
      offeringGroup: "felawallet",
      offeringName: "profile",
      auth: {
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        passkey: `${walletPin}`,
      },
      params: {
        operation: "approve",
        // name: `${userName}`
      },
      user: {
        sessionId: `${sessionId}`,
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        sourceId: `${phoneNumber}`,
        phoneNumber: `${phoneNumber}`,
      },
    };
    console.log(payload);
    axios
      .post(`${FelaMarketPlace.BASE_URL}/offering/fulfil`, payload, {
        headers: felaHeader,
      })
      .then((resp) => {
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
            // expireReportsInRedis(
            //   `${APP_PREFIX_REDIS}:reports:count:global_activatedUsers:${moment().format(
            //     "DMMYYYY"
            //   )}`
            // );
            await redisClient.saddAsync(
              `${APP_PREFIX_REDIS}:reports:set:global_activatedUsers:${moment().format(
                "DMMYYYY"
              )}`,
              phoneNumber
            );
            // expireReportsInRedis(
            //   `${APP_PREFIX_REDIS}:reports:set:global_activatedUsers:${moment().format(
            //     "DMMYYYY"
            //   )}`
            // );
            redisClient.expire(`${APP_PREFIX_REDIS}:${sessionId}`, 300);
          });
        let feedback = `CON Wallet Activation Successful!\nInput 0 or redial *347*999# to start enjoying lifechanging CashToken opportunies`;
        resolve(feedback);
      })
      .catch((resp) => {
        console.log(resp);
        let feedback = `END Wallet Activation Failed!\nPlease try again`;
        resolve(feedback);
      });
  });
}

async function checkCachedWalletStatus(phoneNumber) {
  return new Promise(async (resolve) => {
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
          headers: felaHeader,
        }
      )
      .then(async (response) => {
        console.log(JSON.stringify(response.data, null, 2));
        resolve({
          status: response.data.data.status,
        });
      })
      .catch((e) => {
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
  checkCachedWalletStatus,
  checkWalletStatus,
  activateWalletCall,
  NormalFlow,
  ActivateUser,
};
