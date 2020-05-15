const { redisClient } = require("$config/redisConnectConfig");
const { FelaMarketPlace } = require("$config/index");
const moment = require("moment");
const {
  checkPinForRepetition,
  APP_PREFIX_REDIS,
  expireReportsInRedis,
} = require("$utils");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };

async function resetPin(text, phoneNumber, sessionId) {
  return new Promise(async (resolve, reject) => {
    console.log("Starting Reset PIN Process");
    let response = "";
    let brokenDownText = text.split("*");

    if (brokenDownText.length === 2 && brokenDownText[1] === "4") {
      await redisClient.incrAsync(
        `${APP_PREFIX_REDIS}:reports:count:subMenu_Reset_Pin:${moment().format(
          "DMMYYYY"
        )}`
      );
      // expireReportsInRedis(
      //   `${APP_PREFIX_REDIS}:reports:count:subMenu_Reset_Pin:${moment().format(
      //     "DMMYYYY"
      //   )}`
      // );
      response = "CON Enter a desired PIN (MIN 4 digit)";
      resolve(response);
    } else if (brokenDownText.length === 3) {
      await redisClient.hsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "newPin",
        `${brokenDownText[2]}`
      );
      response = "CON Confirm New PIN";
      resolve(response);
    } else if (brokenDownText.length === 4) {
      let newPin = await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "newPin"
      );
      console.log(`This is the new Pin ${newPin}`);

      if (newPin === brokenDownText[3]) {
        if (newPin.match(/^[0-9]+$/)) {
          let isPinRepeating = checkPinForRepetition(newPin);
          if (newPin.length >= 4 && newPin.length <= 12 && !isPinRepeating) {
            console.log(
              "PIN confirmed successful, going on to reset user's PIN"
            );
            response = await resetPinCall(sessionId, phoneNumber, newPin);
            resolve(response);
          } else if (isPinRepeating) {
            console.log("PIN is repeating i.e PIN is of type 1111");
            response = `CON Repeated digit PINs are not allowed (e.g 1111).\nUse a different pattern of PIN\n\n0 Menu`;
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
        response = `CON Your PIN does not match\n\n0 Menu`;
        resolve(response);
      }
    } else {
      response = "CON Invalid response inputed\n\nEnter 0 Back to home menu";
      resolve(response);
    }
  });
}

async function resetPinCall(sessionId, phoneNumber, walletPin) {
  return new Promise(async (resolve, reject) => {
    axios
      .post(
        `${FelaMarketPlace.BASE_URL}/offering/fulfil`,
        {
          offeringGroup: "felawallet",
          offeringName: "profile",
          auth: {
            source: `${FelaMarketPlace.THIS_SOURCE}`,
            passkey: `${walletPin}`,
          },
          params: {
            operation: "reset",
            // name: `${userName}`
          },
          user: {
            sessionId: `${sessionId}`,
            source: `${FelaMarketPlace.THIS_SOURCE}`,
            sourceId: `${phoneNumber}`,
            phoneNumber: `${phoneNumber}`,
          },
        },
        {
          headers: felaHeader,
        }
      )
      .then((resp) => {
        console.log(resp.data);
        let feedback = `CON Your PIN has been reset successfully!\n\nEnter 0 Back to home menu`;
        resolve(feedback);
      })
      .catch((error) => {
        console.log(JSON.stringify(error.response.data, null, 2));
        if (!!error.response) {
          resolve(
            `CON PIN reset failed!\n${error.response.data.message}\n\nEnter 0 Back to home menu`
          );
        } else {
          resolve(`CON PIN reset failed!\n\nEnter 0 Back to home menu`);
        }
      });
  });
}

module.exports = {
  resetPin,
};
