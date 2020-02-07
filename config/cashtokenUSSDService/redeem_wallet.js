const { getUsersWalletDetails } = require("./cashtokenWallet");
const { processFundDisbursement } = require("./walletCashout");
const { resetPin } = require("./resetPin");
function redeem_wallet(text, phoneNumber, sessionId) {
  return new Promise(async resolve => {
    let response = "";
    let brokenDownText = text.split("*");
    if (text === "1") {
      response = `CON 1 Redeem & Spend\n2 Wallet Info\n3 Reset Wallet PIN\n4 CashToken Gifting Threshold`;
    } else if (brokenDownText[1] === "1") {
      response = await processFundDisbursement(text, phoneNumber, sessionId);
    } else if (brokenDownText.length === 2 && brokenDownText[1] === "2") {
      response = await getUsersWalletDetails(phoneNumber);
    } else if (brokenDownText[1] === "3") {
      response = await resetPin(text, phoneNumber, sessionId);
    }

    resolve(response);
  });
}

module.exports = {
  redeem_wallet
};
