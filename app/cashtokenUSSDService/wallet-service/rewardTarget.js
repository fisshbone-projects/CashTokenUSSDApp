const moment = require("moment");
const { redisClient } = require("$config/redisConnectConfig");
const { APP_PREFIX_REDIS, expireReportsInRedis } = require("$utils");

function rewardTarget(phoneNumber, text, sessionId) {
  return new Promise(async (resolve) => {
    let response = "";
    await redisClient.incrAsync(
      `${APP_PREFIX_REDIS}:reports:count:subMenu_Gifting_Threshold:${moment().format(
        "DMMYYYY"
      )}`
    );
    // expireReportsInRedis(
    //   `${APP_PREFIX_REDIS}:reports:count:subMenu_Gifting_Threshold:${moment().format(
    //     "DMMYYYY"
    //   )}`
    // );
    response = `CON Threshold will be updated soon.\nPlease stay connected\n\n0 Main menu`;
    resolve(response);
  });
}

module.exports = { rewardTarget };
