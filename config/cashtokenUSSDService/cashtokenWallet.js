const { redisClient } = require("../redisConnectConfig");
const { FelaMarketPlace } = require("../index");
const { WalletTypes } = require("../utils");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
// const NAIRASIGN = "\u{020A6}";
const NAIRASIGN = "N";

let response = "";
async function getUsersCashtoken(phoneNumber) {
  return new Promise(async resolve => {
    console.log(`Getting ${phoneNumber}'s cashtokens`);
    let usersTokens = "XX";
    response = `CON Dear Customer, you have ${usersTokens} CashTokens. Your CashTokens qualify you to win up to ${NAIRASIGN}100 million in the weekly draw\n\n0 Menu`;
    resolve(response);
  });
}

async function getUsersWalletDetails(phoneNumber) {
  return new Promise(async resolve => {
    console.log(`Getting ${phoneNumber}'s walletDetails`);
    let { wallet: usersWallet } = await fetchWalletDetails(phoneNumber);
    response = `CON Dear Customer, Your Balances are:\n`;
    let totalBalance = 0.0;
    let index = 1;

    for (let [key, value] of Object.entries(usersWallet)) {
      if (value.title === "iSavings") {
        continue;
      }
      totalBalance += parseFloat(value.balance);
      response += `${index++} ${WalletTypes[value.title]} - ${NAIRASIGN}${
        value.balance
      }\n`;
    }

    response += `${index} Total Wallet Balance - ${NAIRASIGN}${totalBalance.toFixed(
      2
    )}\n\n0 Menu`;

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
          headers: felaHeader
        }
      )
      .then(async response => {
        resolve({
          wallet: response.data.data.wallets
        });
      })
      .catch(e => {
        console.log(e.response.data);
        resolve(
          "CON There was an error retrieving your wallet details\n\n0 Menu"
        );
      });
  });
}

module.exports = {
  getUsersCashtoken,
  getUsersWalletDetails
};
