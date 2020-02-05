const { redisClient } = require("../redisConnectConfig");
const { FelaMarketPlace } = require("../index");
const { checkPinForRepetition } = require("../utils");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };

async function resetPin(text, phoneNumber, sessionId) {
  return new Promise(async (resolve, reject) => {
    console.log("Starting Reset PIN Process");
    let response = "";
    let brokenDownText = text.split("*");

    if (text === "5") {
      response = "CON Enter a desired PIN (MIN 4 digit)";
      resolve(response);
    } else if (brokenDownText.length === 2) {
      await redisClient.hsetAsync(
        `CELDUSSD:${sessionId}`,
        "newPin",
        `${brokenDownText[1]}`
      );
      response = "CON Confirm New PIN";
      resolve(response);
    } else if (brokenDownText.length === 3) {
      let newPin = await redisClient.hgetAsync(
        `CELDUSSD:${sessionId}`,
        "newPin"
      );
      console.log(`This is the new Pin ${newPin}`);

      if (newPin === brokenDownText[2]) {
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
            response = `CON Repeated digit PINs are not allowed (e.g 1111).\n Please use a different kind of PIN\n\n0 Menu`;
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
            passkey: `${walletPin}`
          },
          params: {
            operation: "reset"
            // name: `${userName}`
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
      .then(resp => {
        console.log(resp.data);
        let feedback = `CON Your PIN has been reset successfully!\n\n0 Menu`;
        resolve(feedback);
      })
      .catch(resp => {
        console.log(resp);
        let feedback = `CON PIN reset failed!\n\n0 Menu`;
        resolve(feedback);
      });
  });
}

module.exports = {
  resetPin
};
