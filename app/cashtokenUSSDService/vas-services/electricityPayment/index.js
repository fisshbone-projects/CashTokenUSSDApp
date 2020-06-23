const { redisClient } = require("$config/redisConnectConfig");
const { quickServe } = require("./quickServe");
const { regularBuy } = require("./regularBuy");
const { showLastElectricityPurchase } = require("./lastElectricityPurchase");
const { APP_PREFIX_REDIS, expireReportsInRedis } = require("$utils");
const moment = require("moment");

async function processElectricity(phoneNumber, text, sessionId) {
  return new Promise(async (resolve, reject) => {
    let response = "";
    let brokenDownText = text.split("*");
    let textLength = brokenDownText.length;
    // brokenDownText.unshift("dummyInsert"); //This dummy input helps the code behave as though the LCC service was a sub menu
    // console.log(brokenDownText);
    if (textLength === 2) {
      await redisClient.incrAsync(
        `${APP_PREFIX_REDIS}:reports:count:subMenu_PurchaseElectricity:${moment().format(
          "DMMYYYY"
        )}`
      );
      // expireReportsInRedis(
      //   `${APP_PREFIX_REDIS}:reports:count:subMenu_PurchaseElectricity:${moment().format(
      //     "DMMYYYY"
      //   )}`
      // );
      response = `CON Select Purchase Method:\n1 QuickServe\n2 Regular Buy\n3 Check Last Purchase Details`;
    } else {
      let userResponse = brokenDownText[2];
      let {
        elec_purchase_method: purchaseMethod,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

      if (userResponse === "1" || purchaseMethod === "quickServe") {
        response = await quickServe(phoneNumber, text, sessionId);
      } else if (userResponse === "2" || purchaseMethod === "regularBuy") {
        response = await regularBuy(phoneNumber, text, sessionId);
      } else if (userResponse === "3") {
        response = await showLastElectricityPurchase(phoneNumber);
      } else {
        response = `CON Error!\nInvalid response entered\n\nEnter 0 Back to home menu`;
      }
    }
    resolve(response);
  });
}

module.exports = {
  processElectricity,
};
