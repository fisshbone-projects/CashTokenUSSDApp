const {
  getUsersCashtoken,
  getUsersWalletDetails,
} = require("./cashtokenWallet");
const { processFundWallet } = require("./fundWallet");
const { redeem_wallet } = require("./redeem_wallet");
const { resetPin } = require("./resetPin");
const { processFundDisbursement } = require("./walletCashout");
const { rewardTarget } = require("./rewardTarget");

module.exports = {
  getUsersCashtoken,
  getUsersWalletDetails,
  processFundDisbursement,
  processFundWallet,
  resetPin,
  redeem_wallet,
  rewardTarget,
};
