const { redisClient } = require("$config/redisConnectConfig");
const { FelaMarketPlace } = require("$config/index");
const { WalletTypes, formatNumberAsCurrency } = require("$utils");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
// const NAIRASIGN = "\u{020A6}";
const NAIRASIGN = "N";

let response = "";
async function getUsersCashtoken(phoneNumber) {
  return new Promise(async (resolve) => {
    console.log(`Getting ${phoneNumber}'s cashtokens`);
    let usersTokens = "XX";
    response = `CON Dear Customer, you have ${usersTokens} CashTokens. Your CashTokens qualify you to win up to ${NAIRASIGN}100 million in the weekly draw\n\n0 Menu`;
    resolve(response);
  });
}

async function getUsersWalletDetails(phoneNumber) {
  return new Promise(async (resolve) => {
    let response = "";
    console.log(`Getting ${phoneNumber}'s walletDetails`);
    let walletResponse = await fetchWalletDetails(phoneNumber);
    console.log(walletResponse);

    if (typeof walletResponse === "object") {
      let { wallet: usersWallet } = walletResponse;
      response = `CON Dear Customer, Your Balances are:\n`;
      let totalBalance = 0.0;
      let index = 1;

      for (let [key, value] of Object.entries(usersWallet)) {
        if (value.isPublic) {
          if (value.title === "iSavings") {
            continue;
          }
          totalBalance += parseFloat(value.balance);
          response += `${index++} ${
            WalletTypes[value.title]
          } - ${NAIRASIGN}${formatNumberAsCurrency(value.balance)}\n`;
        } else {
          continue;
        }
      }

      response += `${index} Total Balance - ${NAIRASIGN}${formatNumberAsCurrency(
        totalBalance
      )}\n\n0 Menu`;
    } else {
      response = walletResponse;
    }

    resolve(response);
  });
}

async function fetchWalletDetails(phoneNumber) {
  console.log(phoneNumber);
  return new Promise((resolve, reject) => {
    axios
      .get(
        `${FelaMarketPlace.BASE_URL}/info/felaWallet?accountId=${phoneNumber}`,
        {
          headers: felaHeader,
        }
      )
      .then(async (response) => {
        resolve({
          wallet: response.data.data.wallets,
        });
      })
      .catch((e) => {
        console.log(e);
        resolve(
          "CON There was an error retrieving your wallet details\n\nEnter 0 Back to home menu"
        );
      });
  });
}

module.exports = {
  getUsersCashtoken,
  getUsersWalletDetails,
};
