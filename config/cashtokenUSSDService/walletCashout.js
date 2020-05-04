const { redisClient } = require("../redisConnectConfig");
const moment = require("moment");
const { FelaMarketPlace } = require("../index");
const {
  BANK_NAME_ABR,
  formatNumber,
  getBankCharge,
  APP_PREFIX_REDIS,
  expireReportsInRedis,
} = require("../utils");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
// const NAIRASIGN = "\u{020A6}";
const NAIRASIGN = "N";

async function processFundDisbursement(text, phoneNumber, sessionId) {
  return new Promise(async (resolve, reject) => {
    console.log("Starting the move to bank process");
    let brokenDownText = text.split("*");
    if (brokenDownText.length === 2 && brokenDownText[1] === "1") {
      await redisClient.incrAsync(
        `${APP_PREFIX_REDIS}:reports:count:subMenu_Redeem_Spend:${moment().format(
          "DMMYYYY"
        )}`
      );
      // expireReportsInRedis(
      //   `${APP_PREFIX_REDIS}:reports:count:subMenu_Redeem_Spend:${moment().format(
      //     "DMMYYYY"
      //   )}`
      // );
      let response = `CON Enter the amount you would like to cash-out:`;
      resolve(response);
    }

    let response = await displayBankList(brokenDownText, sessionId);
    if (response !== "") {
      resolve(response);
    } else {
      response = await obtainBankNameForDisbuseMent(brokenDownText, sessionId);
      if (response !== "") {
        resolve(response);
      } else {
        response = await obtainAccountNumberForDisbuseMent(
          brokenDownText,
          sessionId
        );
        if (response !== "") {
          resolve(response);
        } else {
          response = await obtainFinalPermissionForWithdrawal(
            sessionId,
            brokenDownText
          );
          if (response !== "") {
            resolve(response);
          } else {
            response = await processWithdrawTransaction(
              phoneNumber,
              sessionId,
              brokenDownText
            );
            if (response !== "") {
              resolve(response);
            } else {
              response =
                "CON CON Invalid response inputed\n\nEnter 0 Back to home menu";
              resolve(response);
            }
          }
        }
      }
    }
  });
}

async function returnWithdrawalRequestData(sessionId) {
  return new Promise(async (resolve, reject) => {
    let sessionDetails = await redisClient.hgetallAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`
    );
    resolve(sessionDetails);
  });
}

async function obtainFinalPermissionForWithdrawalHelper(
  sessionId,
  textInputted
) {
  console.log("Inputed pin is: " + textInputted);
  await redisClient.hmsetAsync(
    `${APP_PREFIX_REDIS}:${sessionId}`,
    "walletPin",
    textInputted,
    "menuStage",
    "confirmBankTransfer"
  );
  let {
    bankName,
    accountNumber,
    amountToWithdraw,
  } = await returnWithdrawalRequestData(sessionId);

  if ((await redisClient.existsAsync(`${APP_PREFIX_REDIS}:BankCharge`)) === 0) {
    await getBankCharge();
  }
  let bankCharge = await redisClient.getAsync(`${APP_PREFIX_REDIS}:BankCharge`);

  let response = `CON Confirm this transaction:\nBank Name: ${
    BANK_NAME_ABR[bankName]
  }\nAccount Number: ${accountNumber}\nAmount: ${NAIRASIGN}${formatNumber(
    amountToWithdraw
  )}\n(N${bankCharge} charge applies)\n\n1. Confirm\n2. Cancel`;
  return response;
}

async function obtainFinalPermissionForWithdrawal(sessionId, brokenDownText) {
  return new Promise(async (resolve, reject) => {
    let menuStage = await redisClient.hgetAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`,
      "menuStage"
    );
    console.log(`AT OBTAIN FINAL PERM MenuStage: ${menuStage}`);
    if (
      brokenDownText.length == 6 &&
      brokenDownText[5].length >= 4 &&
      menuStage == "obtainingWalletPin"
    ) {
      let response = obtainFinalPermissionForWithdrawalHelper(
        sessionId,
        brokenDownText[5]
      );
      resolve(response);
    } else if (
      brokenDownText.length == 7 &&
      brokenDownText[6].length >= 4 &&
      menuStage == "obtainingWalletPin"
    ) {
      let response = obtainFinalPermissionForWithdrawalHelper(
        sessionId,
        brokenDownText[6]
      );
      resolve(response);
    } else if (
      brokenDownText.length == 8 &&
      brokenDownText[7].length >= 4 &&
      menuStage == "obtainingWalletPin"
    ) {
      let response = obtainFinalPermissionForWithdrawalHelper(
        sessionId,
        brokenDownText[7]
      );
      resolve(response);
    } else if (
      brokenDownText.length == 9 &&
      brokenDownText[8].length >= 4 &&
      menuStage == "obtainingWalletPin"
    ) {
      let response = obtainFinalPermissionForWithdrawalHelper(
        sessionId,
        brokenDownText[8]
      );
      resolve(response);
    } else if (
      brokenDownText.length == 10 &&
      brokenDownText[9].length >= 4 &&
      menuStage == "obtainingWalletPin"
    ) {
      let response = obtainFinalPermissionForWithdrawalHelper(
        sessionId,
        brokenDownText[9]
      );
      resolve(response);
    } else {
      resolve("");
    }
  });
}

async function processWithdrawTransactionHelper(sessionId, phoneNumber) {
  let {
    bankCode,
    accountNumber,
    amountToWithdraw,
    walletPin,
  } = await returnWithdrawalRequestData(sessionId);
  let response = await makeWalletWithdrawal(
    amountToWithdraw,
    bankCode,
    accountNumber,
    phoneNumber,
    sessionId,
    walletPin
  );
  return response;
}

async function processWithdrawTransaction(
  phoneNumber,
  sessionId,
  brokenDownText
) {
  return new Promise(async (resolve, reject) => {
    let menuStage = await redisClient.hgetAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`,
      "menuStage"
    );
    console.log(`AT PROCESS WITHDRAW MenuStage: ${menuStage}`);
    if (
      brokenDownText.length === 7 &&
      brokenDownText[6] === "1" &&
      menuStage == "confirmBankTransfer"
    ) {
      let response = processWithdrawTransactionHelper(sessionId, phoneNumber);
      resolve(response);
    } else if (
      brokenDownText.length === 7 &&
      brokenDownText[6] === "2" &&
      menuStage == "confirmBankTransfer"
    ) {
      let response = "CON Transaction cancelled!\n\nEnter 0 Back to home menu";
      resolve(response);
    } else if (
      brokenDownText.length === 8 &&
      brokenDownText[7] === "1" &&
      menuStage == "confirmBankTransfer"
    ) {
      let response = processWithdrawTransactionHelper(sessionId, phoneNumber);
      resolve(response);
    } else if (
      brokenDownText.length === 8 &&
      brokenDownText[7] === "2" &&
      menuStage == "confirmBankTransfer"
    ) {
      let response = "CON Transaction cancelled!\n\nEnter 0 Back to home menu";
      resolve(response);
    } else if (
      brokenDownText.length === 9 &&
      brokenDownText[8] === "1" &&
      menuStage == "confirmBankTransfer"
    ) {
      let response = processWithdrawTransactionHelper(sessionId, phoneNumber);
      resolve(response);
    } else if (
      brokenDownText.length === 9 &&
      brokenDownText[8] === "2" &&
      menuStage == "confirmBankTransfer"
    ) {
      let response = "CON Transaction cancelled!\n\nEnter 0 Back to home menu";
      resolve(response);
    } else if (
      brokenDownText.length === 10 &&
      brokenDownText[9] === "1" &&
      menuStage == "confirmBankTransfer"
    ) {
      let response = processWithdrawTransactionHelper(sessionId, phoneNumber);
      resolve(response);
    } else if (
      brokenDownText.length === 10 &&
      brokenDownText[9] === "2" &&
      menuStage == "confirmBankTransfer"
    ) {
      let response = "CON Transaction cancelled!\n\nEnter 0 Back to home menu";
      resolve(response);
    } else if (
      brokenDownText.length === 11 &&
      brokenDownText[10] === "1" &&
      menuStage == "confirmBankTransfer"
    ) {
      let response = processWithdrawTransactionHelper(sessionId, phoneNumber);
      resolve(response);
    } else if (
      brokenDownText.length === 11 &&
      brokenDownText[10] === "2" &&
      menuStage == "confirmBankTransfer"
    ) {
      let response = "CON Transaction cancelled!\n\nEnter 0 Back to home menu";
      resolve(response);
    } else {
      resolve("");
    }
  });
}

async function makeWalletWithdrawal(
  amount,
  bankCode,
  accountNo,
  phoneNumber,
  sessionId,
  walletPin
) {
  return new Promise((resolve, reject) => {
    let payload = {
      offeringGroup: "felawallet",
      offeringName: "withdraw",
      auth: {
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        passkey: `${walletPin}`,
      },
      params: {
        amount: `${amount}`,
        bankCode: `${bankCode.length == 2 ? "0" + bankCode : bankCode}`,
        accountNo: `${accountNo}`,
        walletType: "fela",
      },
      user: {
        sessionId: `${sessionId}`,
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        sourceId: `${phoneNumber}`,
        phoneNumber: `${phoneNumber}`,
        passkey: `${walletPin}`,
      },
    };

    console.log("Wallet Cashout Payload", payload);
    axios
      .post(`${FelaMarketPlace.BASE_URL}/offering/fulfil`, payload, {
        headers: felaHeader,
      })
      .then(async (response) => {
        // console.log(JSON.stringify(response.data, null, 2));
        await redisClient.incrAsync(
          `${APP_PREFIX_REDIS}:reports:count:purchases_WalletCashout:${moment().format(
            "DMMYYYY"
          )}`
        );
        // expireReportsInRedis(
        //   `${APP_PREFIX_REDIS}:reports:count:purchases_WalletCashout:${moment().format(
        //     "DMMYYYY"
        //   )}`
        // );
        await redisClient.incrbyAsync(
          `${APP_PREFIX_REDIS}:reports:count:totalValue_WalletCashout:${moment().format(
            "DMMYYYY"
          )}`,
          parseInt(amount)
        );
        // expireReportsInRedis(
        //   `${APP_PREFIX_REDIS}:reports:count:totalValue_WalletCashout:${moment().format(
        //     "DMMYYYY"
        //   )}`
        // );
        console.log(response.data);
        let feedback = `CON Dear Customer, Your Account will be credited within 24 hours\n\nEnter 0 Back to home menu`;
        resolve(feedback);
      })
      .catch((error) => {
        console.log("error");
        console.log(JSON.stringify(error.response.data, null, 2));
        if (!!error.response) {
          resolve(
            `CON Transaction Failed!\n${error.response.data.message}\n\nEnter 0 Back to home menu`
          );
        } else {
          resolve(`CON Transaction Failed!\n\nEnter 0 Back to home menu`);
        }
      });
  });
}

function helperDisplayBankList(dataIndexStart, dataIndexEnd) {
  return new Promise(async (resolve) => {
    let bankList = await redisClient.zrangeAsync(
      `${APP_PREFIX_REDIS}:BankCodes`,
      dataIndexStart,
      dataIndexEnd
    );
    console.log(bankList);
    let newBankNames = bankList.map((value) => {
      return BANK_NAME_ABR[value];
    });

    let response = `CON Select bank:\n`;

    newBankNames.forEach((bank, index) => {
      response += `${index + 1} ${bank}\n`;
    });
    if (dataIndexEnd !== -1) {
      response += `11 Next\n0 Menu`;
    } else {
      response += `0 Menu`;
    }

    resolve(response);
  });
}

async function getBankCodes() {
  return new Promise((resolve, reject) => {
    axios
      .get(`${FelaMarketPlace.BASE_URL}/list/banks`, {
        headers: felaHeader,
      })
      .then((response) => {
        // console.log(JSON.stringify(response.data, null, 2));
        let bankArray = Object.values(response.data.data);
        bankArray.forEach(async (bank) => {
          await redisClient.zaddAsync(
            `${APP_PREFIX_REDIS}:BankCodes`,
            bank.code,
            bank.title
          );
          redisClient.expire(`${APP_PREFIX_REDIS}:BankCodes`, 1800);
          resolve();
        });
      })
      .catch((error) => {
        console.log("error");
        console.log(JSON.stringify(error.response.data, null, 2));
      });
  });
}

async function displayBankList(brokenDownText, sessionId) {
  return new Promise(async (resolve, reject) => {
    if (brokenDownText.length === 3) {
      if (/^[0-9]*$/.test(brokenDownText[2])) {
        await redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "amountToWithdraw",
          brokenDownText[2],
          "menuStage",
          "obtainingBankInputs"
        );
        redisClient
          .existsAsync(`${APP_PREFIX_REDIS}:BankCodes`)
          .then(async (resp) => {
            if (resp === 0) {
              console.log("Fetching bank codes from API");
              getBankCodes()
                .then(async () => {
                  let response = await helperDisplayBankList(0, 9);
                  resolve(response);
                })
                .catch((error) => {
                  console.log("error");
                  console.log(JSON.stringify(error.response.data, null, 2));
                });
            } else if (resp === 1) {
              console.log("Fetching bank codes from Redis Cache");
              let response = await helperDisplayBankList(0, 9);
              resolve(response);
            }
          });
      } else {
        console.log("Amount is invalid");
        response = `CON Error! Inputted amount is not a valid number\n\nEnter 0 to start over`;
        resolve(response);
      }
    } else if (
      brokenDownText.length === 4 &&
      parseInt(brokenDownText[3], 10) === 11
    ) {
      redisClient
        .existsAsync(`${APP_PREFIX_REDIS}:BankCodes`)
        .then(async (resp) => {
          if (resp === 0) {
            await getBankCodes();
          }

          let response = await helperDisplayBankList(10, 15);
          resolve(response);
        });
    } else if (
      brokenDownText.length === 5 &&
      parseInt(brokenDownText[4], 10) === 11
    ) {
      redisClient
        .existsAsync(`${APP_PREFIX_REDIS}:BankCodes`)
        .then(async (resp) => {
          if (resp === 0) {
            await getBankCodes();
          }

          let response = await helperDisplayBankList(16, 21);
          resolve(response);
        });
    } else if (
      brokenDownText.length === 6 &&
      parseInt(brokenDownText[5], 10) === 11
    ) {
      redisClient
        .existsAsync(`${APP_PREFIX_REDIS}:BankCodes`)
        .then(async (resp) => {
          if (resp === 0) {
            await getBankCodes();
          }

          let response = await helperDisplayBankList(22, 27);
          resolve(response);
        });
    } else if (
      brokenDownText.length === 7 &&
      parseInt(brokenDownText[6], 10) === 11
    ) {
      redisClient
        .existsAsync(`${APP_PREFIX_REDIS}:BankCodes`)
        .then(async (resp) => {
          if (resp === 0) {
            await getBankCodes();
          }

          let response = await helperDisplayBankList(28, -1);
          resolve(response);
        });
    } else {
      resolve("");
    }
  });
}

async function obtainBankNameForDisbuseMent(brokenDownText, sessionId) {
  return new Promise(async (resolve, reject) => {
    let menuStage = await redisClient.hgetAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`,
      "menuStage"
    );
    console.log(`AT OBTAIN BANKNAME MenuStage: ${menuStage}`);
    if (
      brokenDownText.length === 4 &&
      parseInt(brokenDownText[3], 10) <= 10 &&
      menuStage == "obtainingBankInputs"
    ) {
      let selectedBankID = parseInt(brokenDownText[3], 10);
      console.log(selectedBankID);
      let selectedBankName = await redisClient.zrangeAsync(
        `${APP_PREFIX_REDIS}:BankCodes`,
        selectedBankID - 1,
        selectedBankID - 1,
        "withscores"
      );
      console.log(selectedBankName);
      await redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "bankName",
        selectedBankName[0],
        "bankCode",
        selectedBankName[1],
        "menuStage",
        "obtainingAccountNumber"
      );
      resolve("CON Enter your account number:");
    } else if (
      brokenDownText.length === 5 &&
      parseInt(brokenDownText[4], 10) <= 6 &&
      menuStage == "obtainingBankInputs"
    ) {
      let selectedBankID = parseInt(brokenDownText[4], 10) + 10;
      console.log(selectedBankID);
      let selectedBankName = await redisClient.zrangeAsync(
        `${APP_PREFIX_REDIS}:BankCodes`,
        selectedBankID - 1,
        selectedBankID - 1,
        "withscores"
      );
      console.log(selectedBankName);
      await redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "bankName",
        selectedBankName[0],
        "bankCode",
        selectedBankName[1],
        "menuStage",
        "obtainingAccountNumber"
      );
      resolve("CON Enter your account number:");
    } else if (
      brokenDownText.length === 6 &&
      parseInt(brokenDownText[5], 10) <= 6 &&
      menuStage == "obtainingBankInputs"
    ) {
      let selectedBankID = parseInt(brokenDownText[5], 10) + 16;
      // console.log(parseInt(brokenDownText[4], 10));
      console.log(selectedBankID);
      let selectedBankName = await redisClient.zrangeAsync(
        `${APP_PREFIX_REDIS}:BankCodes`,
        selectedBankID - 1,
        selectedBankID - 1,
        "withscores"
      );
      console.log(selectedBankName);
      await redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "bankName",
        selectedBankName[0],
        "bankCode",
        selectedBankName[1],
        "menuStage",
        "obtainingAccountNumber"
      );
      resolve("CON Enter your account number:");
    } else if (
      brokenDownText.length === 7 &&
      parseInt(brokenDownText[6], 10) <= 6 &&
      menuStage == "obtainingBankInputs"
    ) {
      let selectedBankID = parseInt(brokenDownText[6], 10) + 22;
      console.log(selectedBankID);
      let selectedBankName = await redisClient.zrangeAsync(
        `${APP_PREFIX_REDIS}:BankCodes`,
        selectedBankID - 1,
        selectedBankID - 1,
        "withscores"
      );
      console.log(selectedBankName);
      await redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "bankName",
        selectedBankName[0],
        "bankCode",
        selectedBankName[1],
        "menuStage",
        "obtainingAccountNumber"
      );
      resolve("CON Enter your account number:");
    } else if (
      brokenDownText.length === 8 &&
      parseInt(brokenDownText[7], 10) <= 4 &&
      menuStage == "obtainingBankInputs"
    ) {
      let selectedBankID = parseInt(brokenDownText[7], 10) + 28;
      console.log(selectedBankID);
      let selectedBankName = await redisClient.zrangeAsync(
        `${APP_PREFIX_REDIS}:BankCodes`,
        selectedBankID - 1,
        selectedBankID - 1,
        "withscores"
      );
      console.log(selectedBankName);
      await redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "bankName",
        selectedBankName[0],
        "bankCode",
        selectedBankName[1],
        "menuStage",
        "obtainingAccountNumber"
      );
      resolve("CON Enter your account number:");
    } else {
      resolve("");
    }
  });
}

async function saveAccountNumber(accountNumber, sessionId) {
  return new Promise(async (resolve) => {
    console.log("Account Number is: " + accountNumber);
    await redisClient.hmsetAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`,
      "accountNumber",
      accountNumber,
      "menuStage",
      "obtainingWalletPin"
    );
    resolve("CON Enter your wallet PIN:");
  });
}

async function obtainAccountNumberForDisbuseMent(brokenDownText, sessionId) {
  return new Promise(async (resolve, reject) => {
    let response = "";
    let menuStage = await redisClient.hgetAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`,
      "menuStage"
    );
    console.log(`AT OBTAIN ACCOUNT NUMBER MenuStage: ${menuStage}`);
    if (brokenDownText.length == 5 && menuStage == "obtainingAccountNumber") {
      let accountNumber = brokenDownText[4];
      if (accountNumber.length == 10 && /^[0-9]*$/.test(accountNumber)) {
        response = await saveAccountNumber(accountNumber, sessionId);
        resolve(response);
      } else {
        console.log("Account Number is invalid");
        response = `CON Error! Inputed account number is invalid\n\nEnter 0 to start over`;
        resolve(response);
      }
    } else if (
      brokenDownText.length == 6 &&
      menuStage == "obtainingAccountNumber"
    ) {
      let accountNumber = brokenDownText[5];
      if (accountNumber.length == 10 && /^[0-9]*$/.test(accountNumber)) {
        response = await saveAccountNumber(accountNumber, sessionId);
        resolve(response);
      } else {
        console.log("Account Number is invalid");
        response = `CON Error! Inputed account number is invalid\n\nEnter 0 to start over`;
        resolve(response);
      }
    } else if (
      brokenDownText.length == 7 &&
      menuStage == "obtainingAccountNumber"
    ) {
      let accountNumber = brokenDownText[6];
      if (accountNumber.length == 10 && /^[0-9]*$/.test(accountNumber)) {
        response = await saveAccountNumber(accountNumber, sessionId);
        resolve(response);
      } else {
        console.log("Account Number is invalid");
        response = `CON Error! Inputed account number is invalid\n\nEnter 0 to start over`;
        resolve(response);
      }
    } else if (
      brokenDownText.length == 8 &&
      menuStage == "obtainingAccountNumber"
    ) {
      let accountNumber = brokenDownText[7];
      if (accountNumber.length == 10 && /^[0-9]*$/.test(accountNumber)) {
        response = await saveAccountNumber(accountNumber, sessionId);
        resolve(response);
      } else {
        console.log("Account Number is invalid");
        response = `CON Error! Inputed account number is invalid\n\nEnter 0 to start over`;
        resolve(response);
      }
    } else if (
      brokenDownText.length == 9 &&
      menuStage == "obtainingAccountNumber"
    ) {
      let accountNumber = brokenDownText[8];
      if (accountNumber.length == 10 && /^[0-9]*$/.test(accountNumber)) {
        response = await saveAccountNumber(accountNumber, sessionId);
        resolve(response);
      } else {
        console.log("Account Number is invalid");
        response = `CON Error! Inputed account number is invalid\n\nEnter 0 to start over`;
        resolve(response);
      }
    } else {
      resolve("");
    }
  });
}

module.exports = {
  processFundDisbursement,
};
