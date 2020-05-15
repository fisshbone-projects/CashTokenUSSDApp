const { redisClient } = require("$config/redisConnectConfig");
const moment = require("moment");
const { processElectricity } = require("./electricityPayment");
const { processCableTv } = require("./cabletvPayment");
const { processLCC } = require("./LCC");
// const { getUserStat } = require("../utils/cashTokenApi");
const { APP_PREFIX_REDIS, expireReportsInRedis } = require("$utils");
// const { FelaMarketPlace } = require("../index");
// const axios = require("axios");

// Object.freeze(WalletTypes);

async function servePayBillsRequest(phoneNumber, text, sessionId) {
  return new Promise(async (resolve) => {
    let response = "";
    if (text === "6") {
      await redisClient.incrAsync(
        `${APP_PREFIX_REDIS}:reports:count:topMenu_PayBills:${moment().format(
          "DMMYYYY"
        )}`
      );
      // expireReportsInRedis(
      //   `${APP_PREFIX_REDIS}:reports:count:topMenu_PayBills:${moment().format(
      //     "DMMYYYY"
      //   )}`
      // );
      response = `CON 1 Pay Electricity Bills\n2 Pay CableTV Bills\n3 Pay LCC Bills\n0 Main menu`;
      resolve(response);
    } else if (text.startsWith("6*1")) {
      response = await processElectricity(phoneNumber, text, sessionId);
      resolve(response);
    } else if (text.startsWith("6*2")) {
      response = await processCableTv(phoneNumber, text, sessionId);
      resolve(response);
    } else if (text.startsWith("6*3")) {
      response = await processLCC(phoneNumber, text, sessionId);
      resolve(response);
    } else {
      response =
        "CON Please input a valid service option\n\nEnter 0 Back to home menu";
      resolve(response);
    }
  });
}

module.exports = {
  servePayBillsRequest,
};
