const { redisClient } = require("$config/redisConnectConfig");
const { quickServe } = require("./quickServe");
const { regularBuy } = require("./regularBuy");
const { APP_PREFIX_REDIS, expireReportsInRedis } = require("$utils");
const moment = require("moment");

async function processData(text, phoneNumber, sessionId) {
  return new Promise(async (resolve, reject) => {
    let response = "";
    let brokenDownText = text.split("*");
    let textLength = brokenDownText.length;
    // brokenDownText.unshift("dummyInsert"); //This dummy input helps the code behave as though the LCC service was a sub menu
    // console.log(brokenDownText);
    if (textLength === 1) {
      await redisClient.incrAsync(
        `${APP_PREFIX_REDIS}:reports:count:topMenu_Data:${moment().format(
          "DMMYYYY"
        )}`
      );
      // expireReportsInRedis(
      //   `${APP_PREFIX_REDIS}:reports:count:topMenu_Data:${moment().format(
      //     "DMMYYYY"
      //   )}`
      // );

      response = `CON Select Purchase Method:\n1 QuickServe\n2 Regular Buy`;
    } else {
      let userResponse = brokenDownText[1];
      let {
        data_purchase_method: purchaseMethod,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

      if (userResponse === "1" || purchaseMethod === "quickServe") {
        response = await quickServe(phoneNumber, text, sessionId);
      } else if (userResponse === "2" || purchaseMethod === "regularBuy") {
        response = await regularBuy(phoneNumber, text, sessionId);
      } else {
        response = `CON Error!\nInvalid response entered\n\nEnter 0 Back to home menu`;
      }
    }
    resolve(response);
  });
}

module.exports = {
  processData,
};
