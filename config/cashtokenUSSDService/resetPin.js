const { redisClient } = require("../redisConnectConfig");
const { FelaMarketPlace } = require("../index");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };

async function resetPin(text, phoneNumber, sessionId) {
  return new Promise(async (resolve, reject) => {
    console.log("Starting Reset PIN Process");
    let response = "";
    let brokenDownText = text.split("*");

    if (text === "5") {
      response = "CON Enter a 6 digit PIN";
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
        if (newPin.length === 6) {
          console.log("PIN confirmed successful, going on to reset user's PIN");
          response = await resetPinCall(sessionId, phoneNumber, newPin);
          resolve(response);
        } else {
          console.log("PIN length is not 6 digits.");
          response = `END PIN entered is not a 6 digit PIN.\nPlease try again.`;
          resolve(response);
        }
      } else {
        console.log("PIN not matching");
        response = `END Your PIN does not match, please try again.`;
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
        let feedback = `END Your PIN has been reset successfully!`;
        resolve(feedback);
      })
      .catch(resp => {
        console.log(resp);
        let feedback = `END PIN reset failed.!\nPlease try again.`;
        resolve(feedback);
      });
  });
}

// function processResetPin(brokenDownText, phoneNumber, sessionId) {
//   return new Promise(async resolve => {
//     let response = "";
//     if (brokenDownText.length == 2) {
//       response = `CON Enter Current PIN:`;
//       resolve(response);
//     } else if (brokenDownText.length === 3) {
//       console.log(`Entering current PIN: ${brokenDownText[2]}`);
//       await redisClient.hsetAsync(
//         `CELDUSSD:${sessionId}`,
//         "walletPin",
//         `${brokenDownText[2]}`
//       );

//       response = `CON Enter desired 6 digit PIN: `;
//       resolve(response);
//     } else if (brokenDownText.length === 4) {
//       console.log(`Entering New PIN: ${brokenDownText[3]}`);
//       await redisClient.hsetAsync(
//         `CELDUSSD:${sessionId}`,
//         "walletNewPin",
//         `${brokenDownText[3]}`
//       );

//       response = `CON Confirm New PIN: `;
//       resolve(response);
//     } else if (brokenDownText.length === 5) {
//       let newPin = await redisClient.hgetAsync(
//         `CELDUSSD:${sessionId}`,
//         "walletNewPin"
//       );

//       if (brokenDownText[4] === newPin && newPin.length === 6) {
//         console.log("New pin being set is correct");
//         response = `END Your PIN has been reset successfully`;
//         resolve(response);
//       } else {
//         if (newPin.length < 6) {
//           console.log("New pin didn't pass 6 digit test");
//           response = `END Inputted PIN is not 6 digits, try again.`;
//           resolve(response);
//         } else {
//           console.log("New pin not set correctly");
//           response = `END PINs are not the same, try again.`;
//           resolve(response);
//         }
//       }

//       response = `CON Enter desired 6 digit PIN: `;
//       resolve(response);
//     }
//   });
// }

// function processForgotPin(brokenDownText, phoneNumber, sessionId) {
//   return new Promise(resolve => {
//     let response = "";
//     response = `END Temporary PIN will be sent via sms`;
//     resolve(response);
//   });
// }

module.exports = {
  resetPin
};
