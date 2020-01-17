const { FelaMarketPlace } = require("../index");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
const axios = require("axios");
const { redisClient } = require("../redisConnectConfig");

function getUserStatus(user) {
  return new Promise(async resolve => {
    axios
      .get(
        `${FelaMarketPlace.BASE_URL}/info/felaWallet?accountId=${user.msisdn}`,
        {
          headers: felaHeader
        }
      )
      .then(async resp => {
        resolve({
          code: resp.data.code,
          message: "User Detail Fetched",
          data: {
            name: resp.data.data.name,
            status: resp.data.data.status,
            menus: {
              "Your Win Wallet": {},
              "CashOut/Spend": {
                "Move to Bank": {},
                "Gift/Buy Airtime/Data": {
                  "Purchase Airtime": {},
                  "Purchase Data": {}
                },
                "Pay Electricity Bills": {},
                "Buy CashTokens": {}
              },
              "Reset Pin": {},
              "CashToken Latest Deals": {},
              "Gift/Buy CashToken Bundles": {}
            }
          }
        });
      })
      .catch(e => {
        console.log(e.response.data);
        resolve({
          code: 200,
          message: "User Detail Fetched",
          data: {
            status: "inactive"
          }
        });
      });
  });
}

function fulfilWalletActivation(params, user) {
  return new Promise(async resolve => {
    axios
      .post(
        `${FelaMarketPlace.BASE_URL}/offering/fulfil`,
        {
          offeringGroup: "felawallet",
          offeringName: "profile",
          auth: {
            source: `${FelaMarketPlace.THIS_SOURCE}`,
            passkey: `${params.pin}`
          },
          params: {
            operation: "approve",
            name: `${params.name}`
          },
          user: {
            sessionId: `${user.sessionId}`,
            source: `${FelaMarketPlace.THIS_SOURCE}`,
            sourceId: `${user.msisdn}`,
            phoneNumber: `${user.msisdn}`
          }
        },
        {
          headers: felaHeader
        }
      )
      .then(resp => {
        resolve({
          code: 200,
          message: "Wallet Activated"
        });
      })
      .catch(resp => {
        console.log(resp);
        resolve({
          code: 500,
          message: "Failed to activate wallet successfully"
        });
      });
  });
}

function getWalletBalance(user) {
  return new Promise(async resolve => {
    axios
      .get(
        `${FelaMarketPlace.BASE_URL}/info/felaWallet?accountId=${user.msisdn}`,
        {
          headers: felaHeader
        }
      )
      .then(async resp => {
        resolve({
          code: resp.data.code,
          message: "Wallet Balance Fetched",
          data: {
            wallets: [
              {
                title: "AirtelThanks Wallet",
                balance: resp.data.data.wallets.fela.balance,
                id: resp.data.data.wallets.fela.id
              }
            ]
          }
        });
      })
      .catch(e => {
        console.log(e.response.data);
        resolve({
          code: 500,
          message: "There was an error retrieving wallet balance"
        });
      });
  });
}

function fulfilCashOut(params, user) {
  return new Promise(async resolve => {
    axios
      .post(
        `${FelaMarketPlace.BASE_URL}/offering/fulfil`,
        {
          offeringGroup: "felawallet",
          offeringName: "withdraw",
          auth: {
            source: `${FelaMarketPlace.THIS_SOURCE}`,
            passkey: `${params.walletPin}`
          },
          params: {
            amount: `${params.amount}`,
            bankCode: `${params.bankCode}`,
            accountNo: `${params.accountNumber}`,
            walletType: "fela"
          },
          user: {
            sessionId: `${user.sessionId}`,
            source: `${FelaMarketPlace.THIS_SOURCE}`,
            sourceId: `${user.msisdn}`,
            phoneNumber: `${user.msisdn}`,
            passkey: `${params.walletPin}`
          }
        },
        {
          headers: felaHeader
        }
      )
      .then(response => {
        // console.log(JSON.stringify(response.data, null, 2));
        resolve({ code: 200, message: "Transaction Successful!" });
      })
      .catch(error => {
        console.log("error");
        // console.log(error);
        console.log(JSON.stringify(error.response.data, null, 2));
        let feedback = `END Transaction Failed!`;
        if (error.response.data.message.includes("Insufficient user balance")) {
          feedback = {
            code: 401,
            message: "Transaction failed. Insufficient wallet balace"
          };
        } else if (
          error.response.data.message.includes("authentication failed")
        ) {
          feedback = {
            code: 401,
            message: "Transaction failed. Wallet Authentication failed"
          };
        }
        resolve(feedback);
      });
  });
}

function listBanks() {
  return new Promise(async resolve => {
    redisClient.existsAsync("CELDUSSD:BankCodes").then(async resp => {
      if (resp === 0) {
        console.log("Fetching Bank Lists from external API");
        await getBankCodes().catch(resp => {
          resolve(resp);
        });
      }

      let bankDetails = await redisClient.getAsync("CELDUSSD:BankCodes");
      let transformedBankDetails = JSON.parse(bankDetails);
      resolve({
        code: 200,
        message: "List successfully fetched",
        data: transformedBankDetails
      });
    });
  });
}

async function getBankCodes() {
  return new Promise((resolve, reject) => {
    axios
      .get(`${FelaMarketPlace.BASE_URL}/list/banks`, {
        headers: felaHeader
      })
      .then(async response => {
        // console.log(JSON.stringify(response.data, null, 2));
        let bankDetails = JSON.stringify(response.data.data);
        await redisClient.setAsync("CELDUSSD:BankCodes", `${bankDetails}`);
        redisClient.expire(`CELDUSSD:BankCodes`, 86400);
        resolve();
      })
      .catch(error => {
        console.log("error");
        console.log(JSON.stringify(error.response.data, null, 2));
        reject({
          code: 503,
          message: "Service unavailable at the moment"
        });
      });
  });
}

function purchaseAirtime(params, user) {
  return new Promise(resolve => {
    axios
      .post(
        `${FelaMarketPlace.BASE_URL}/payment/request`,
        {
          offeringGroup: "core",
          offeringName: "airtime",
          method: "online",
          auth: {
            source: `${FelaMarketPlace.THIS_SOURCE}`,
            passkey: `${params.walletPin}`
          },
          params: {
            amount: `${params.amount}`,
            recipient: `${params.recipientNumber}`,
            network: "Airtel",
            passkey: `${params.amount}`
          },
          user: {
            sessionId: `${user.sessionId}`,
            source: `${FelaMarketPlace.THIS_SOURCE}`,
            sourceId: `${user.msisdn}`,
            phoneNumber: `${user.msisdn}`
          }
        },
        {
          headers: felaHeader
        }
      )
      .then(response => {
        console.log(JSON.stringify(response.data, null, 2));
        resolve({
          code: 200,
          message: "Transaction Successful"
        });
      })
      .catch(error => {
        console.log(JSON.stringify(error.response.data, null, 2));
        resolve({
          code: 401,
          message: "Transaction failed"
        });
      });
  });
}

function purchaseData(params, user) {
  return new Promise(resolve => {
    axios
      .post(
        `${FelaMarketPlace.BASE_URL}/payment/request`,
        {
          offeringGroup: "core",
          offeringName: "databundle",
          method: "felawallet",
          auth: {
            source: `${FelaMarketPlace.THIS_SOURCE}`,
            passkey: `${params.walletPin}`
          },
          params: {
            account_id: `${params.recipientNumber}`,
            bundle_code: `${params.bundleCode}`,
            network: "Airtel",
            passkey: `${params.walletPin}`
          },
          user: {
            sessionId: `${user.sessionId}`,
            source: `${FelaMarketPlace.THIS_SOURCE}`,
            sourceId: `${user.msisdn}`,
            phoneNumber: `${user.msisdn}`
          }
        },
        {
          headers: felaHeader
        }
      )
      .then(response => {
        console.log(JSON.stringify(response.data, null, 2));
        resolve({
          code: 200,
          message: "Transaction Successful"
        });
      })
      .catch(error => {
        console.log(JSON.stringify(error.response.data, null, 2));
        resolve({
          code: 401,
          message: "Transaction failed"
        });
      });
  });
}

function listDataPlans() {
  return new Promise(async resolve => {
    redisClient.existsAsync("CELDUSSD:DataPlanCode").then(async resp => {
      if (resp === 0) {
        console.log("Fetching DataPlan Codes from external API");
        await getDataBundleCodes().catch(resp => {
          resolve(resp);
        });
      }

      let dataPlanCodes = await redisClient.getAsync(
        "CELDUSSD:DataPlanCode"
      );
      let transformedDataPlanCodes = JSON.parse(dataPlanCodes);
      resolve({
        code: 200,
        message: "List successfully fetched",
        data: transformedDataPlanCodes
      });
    });
  });
}

async function getDataBundleCodes() {
  return new Promise((resolve, reject) => {
    axios
      .get(
        `${FelaMarketPlace.BASE_URL}/list/dataBundles?provider_code=Airtel`,
        {
          headers: felaHeader
        }
      )
      .then(async response => {
        // console.log(JSON.stringify(response.data, null, 2));
        let dataPlanCodes = JSON.stringify(response.data.data);
        await redisClient.setAsync(
          "CELDUSSD:DataPlanCode",
          `${dataPlanCodes}`
        );
        redisClient.expire(`CELDUSSD:DataPlanCode`, 86400);
        resolve();
      })
      .catch(error => {
        console.log("error");
        console.log(JSON.stringify(error.response.data, null, 2));
        reject({
          code: 503,
          message: "Service unavailable at the moment"
        });
      });
  });
}

module.exports = {
  getWalletBalance,
  getUserStatus,
  fulfilWalletActivation,
  fulfilCashOut,
  listBanks,
  purchaseAirtime,
  purchaseData,
  listDataPlans
};
