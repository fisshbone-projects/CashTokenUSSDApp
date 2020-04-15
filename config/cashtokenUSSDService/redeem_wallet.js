const moment = require("moment");
const { getUsersWalletDetails } = require("./cashtokenWallet");
const { processFundDisbursement } = require("./walletCashout");
const { resetPin } = require("./resetPin");
const { processFundWallet } = require("./fundWallet");
const { redisClient } = require("../redisConnectConfig");
const { APP_PREFIX_REDIS, expireReportsInRedis } = require("../utils");
function redeem_wallet(text, phoneNumber, sessionId) {
  return new Promise(async resolve => {
    let response = "";
    let brokenDownText = text.split("*");
    if (text === "1") {
      await redisClient.incrAsync(
        `${APP_PREFIX_REDIS}:reports:count:topMenu_Redeem_Wallet:${moment().format(
          "DMMYYYY"
        )}`
      );
      expireReportsInRedis(
        `${APP_PREFIX_REDIS}:reports:count:topMenu_Redeem_Wallet:${moment().format(
          "DMMYYYY"
        )}`
      );
      response = `CON 1 Redeem & Spend\n2 Wallet Info\n3 Fund Wallet \n4 Reset Wallet PIN\n5 CashToken Gifting Threshold\n\n0 Menu`;
    } else if (brokenDownText[1] === "1") {
      response = await processFundDisbursement(text, phoneNumber, sessionId);
    } else if (brokenDownText.length === 2 && brokenDownText[1] === "2") {
      await redisClient.incrAsync(
        `${APP_PREFIX_REDIS}:reports:count:subMenu_Wallet_Info:${moment().format(
          "DMMYYYY"
        )}`
      );
      expireReportsInRedis(
        `${APP_PREFIX_REDIS}:reports:count:subMenu_Wallet_Info:${moment().format(
          "DMMYYYY"
        )}`
      );
      response = await getUsersWalletDetails(phoneNumber);
    } else if (brokenDownText[1] === "3") {
      response = await processFundWallet(phoneNumber, text, sessionId);
    } else if (brokenDownText[1] === "4") {
      response = await resetPin(text, phoneNumber, sessionId);
    } else if (brokenDownText.length === 2 && brokenDownText[1] === "5") {
      await redisClient.incrAsync(
        `${APP_PREFIX_REDIS}:reports:count:subMenu_Gifting_Threshold:${moment().format(
          "DMMYYYY"
        )}`
      );
      expireReportsInRedis(
        `${APP_PREFIX_REDIS}:reports:count:subMenu_Gifting_Threshold:${moment().format(
          "DMMYYYY"
        )}`
      );
      response = `CON Threshold will be updated soon.\nPlease stay tuned\n\nEnter 0 Back to home menu`;
    } else {
      response =
        "CON Please input a valid service option\n\nEnter 0 Back to home menu";
      resolve(response);
    }

    resolve(response);
  });
}

module.exports = {
  redeem_wallet
};
