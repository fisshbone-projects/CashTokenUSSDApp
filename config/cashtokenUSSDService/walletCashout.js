const { redisClient } = require("../redisConnectConfig");
const { FelaMarketPlace } = require("../index");
const { BANK_NAME_ABR } = require("../utils");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
// const NAIRASIGN = "\u{020A6}";
const NAIRASIGN = "N";

async function processFundDisbursement(text, phoneNumber, sessionId) {
  return new Promise(async (resolve, reject) => {
    console.log("Starting the move to bank process");
    if (text === "4") {
      let response = `CON Enter the amount you would like to cash-out:`;
      resolve(response);
    }
    let brokenDownText = text.split("*");

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
              response = "CON An error occured, please try again\n\n0 Menu";
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
      `CELDUSSD:${sessionId}`
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
    `CELDUSSD:${sessionId}`,
    "walletPin",
    textInputted,
    "menuStage",
    "confirmBankTransfer"
  );
  let {
    bankName,
    accountNumber,
    amountToWithdraw
  } = await returnWithdrawalRequestData(sessionId);
  let response = `CON Confirm this transaction:\nBank Name: ${
    BANK_NAME_ABR[bankName]
  }\nAccount Number: ${accountNumber}\nAmount: ${NAIRASIGN}${formatNumber(
    amountToWithdraw
  )}\n\n1. Confirm\n2. Cancel`;
  return response;
}

async function obtainFinalPermissionForWithdrawal(sessionId, brokenDownText) {
  return new Promise(async (resolve, reject) => {
    let menuStage = await redisClient.hgetAsync(
      `CELDUSSD:${sessionId}`,
      "menuStage"
    );
    console.log(`AT OBTAIN FINAL PERM MenuStage: ${menuStage}`);
    if (
      brokenDownText.length == 5 &&
      brokenDownText[4].length >= 4 &&
      menuStage == "obtainingWalletPin"
    ) {
      let response = obtainFinalPermissionForWithdrawalHelper(
        sessionId,
        brokenDownText[4]
      );
      resolve(response);
    } else if (
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
    walletPin
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
      `CELDUSSD:${sessionId}`,
      "menuStage"
    );
    console.log(`AT PROCESS WITHDRAW MenuStage: ${menuStage}`);
    if (
      brokenDownText.length === 6 &&
      brokenDownText[5] === "1" &&
      menuStage == "confirmBankTransfer"
    ) {
      let response = processWithdrawTransactionHelper(sessionId, phoneNumber);
      resolve(response);
    } else if (
      brokenDownText.length === 6 &&
      brokenDownText[5] === "2" &&
      menuStage == "confirmBankTransfer"
    ) {
      let response = "CON Transaction cancelled!\n\n0 Menu";
      resolve(response);
    } else if (
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
      let response = "CON Transaction cancelled!\n\n0 Menu";
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
      let response = "CON Transaction cancelled!\n\n0 Menu";
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
      let response = "CON Transaction cancelled!\n\n0 Menu";
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
      let response = "CON Transaction cancelled!\n\n0 Menu";
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
        passkey: `${walletPin}`
      },
      params: {
        amount: `${amount}`,
        bankCode: `${bankCode.length == 2 ? "0" + bankCode : bankCode}`,
        accountNo: `${accountNo}`,
        walletType: "fela"
      },
      user: {
        sessionId: `${sessionId}`,
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        sourceId: `${phoneNumber}`,
        phoneNumber: `${phoneNumber}`,
        passkey: `${walletPin}`
      }
    };

    console.log("Wallet Cashout Payload", payload);
    axios
      .post(`${FelaMarketPlace.BASE_URL}/offering/fulfil`, payload, {
        headers: felaHeader
      })
      .then(response => {
        // console.log(JSON.stringify(response.data, null, 2));
        console.log(response);
        let feedback = `CON Dear Customer, Your Account will be credited within 24 hours\n\n0 Menu`;
        resolve(feedback);
      })
      .catch(error => {
        console.log("error");
        // console.log(error);
        console.log(JSON.stringify(error.response.data, null, 2));
        let feedback = `CON Transaction Failed!`;
        if (error.response.data.message.includes("Insufficient user balance")) {
          feedback += `\nInsufficient user balance in wallet\n\n0 Menu`;
        } else if (
          error.response.data.message.includes("authentication failed")
        ) {
          feedback = `Process failed!\n${error.response.data.response.body.message}\n\n0 Menu`;
        } else {
          feedback += `\n\n0 Menu`;
        }
        resolve(feedback);
      });
  });
}

function helperDisplayBankList(dataIndexStart, dataIndexEnd) {
  return new Promise(async resolve => {
    let bankList = await redisClient.zrangeAsync(
      "CELDUSSD:BankCodes",
      dataIndexStart,
      dataIndexEnd
    );
    console.log(bankList);
    let newBankNames = bankList.map(value => {
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
        headers: felaHeader
      })
      .then(response => {
        // console.log(JSON.stringify(response.data, null, 2));
        let bankArray = Object.values(response.data.data);
        bankArray.forEach(async bank => {
          await redisClient.zaddAsync(
            `CELDUSSD:BankCodes`,
            bank.code,
            bank.title
          );
          redisClient.expire(`CELDUSSD:BankCodes`, 1800);
          resolve();
        });
      })
      .catch(error => {
        console.log("error");
        console.log(JSON.stringify(error.response.data, null, 2));
      });
  });
}

async function displayBankList(brokenDownText, sessionId) {
  return new Promise(async (resolve, reject) => {
    if (brokenDownText.length === 2) {
      await redisClient.hmsetAsync(
        `CELDUSSD:${sessionId}`,
        "amountToWithdraw",
        brokenDownText[1],
        "menuStage",
        "obtainingBankInputs"
      );
      redisClient.existsAsync(`CELDUSSD:BankCodes`).then(async resp => {
        if (resp === 0) {
          console.log("Fetching bank codes from API");
          getBankCodes()
            .then(async () => {
              let response = await helperDisplayBankList(0, 9);
              resolve(response);
            })
            .catch(error => {
              console.log("error");
              console.log(JSON.stringify(error.response.data, null, 2));
            });
        } else if (resp === 1) {
          console.log("Fetching bank codes from Redis Cache");
          let response = await helperDisplayBankList(0, 9);
          resolve(response);
        }
      });
    } else if (
      brokenDownText.length === 3 &&
      parseInt(brokenDownText[2], 10) === 11
    ) {
      redisClient.existsAsync(`CELDUSSD:BankCodes`).then(async resp => {
        if (resp === 0) {
          await getBankCodes();
        }

        let response = await helperDisplayBankList(10, 15);
        resolve(response);
      });
    } else if (
      brokenDownText.length === 4 &&
      parseInt(brokenDownText[3], 10) === 11
    ) {
      redisClient.existsAsync(`CELDUSSD:BankCodes`).then(async resp => {
        if (resp === 0) {
          await getBankCodes();
        }

        let response = await helperDisplayBankList(16, 21);
        resolve(response);
      });
    } else if (
      brokenDownText.length === 5 &&
      parseInt(brokenDownText[4], 10) === 11
    ) {
      redisClient.existsAsync(`CELDUSSD:BankCodes`).then(async resp => {
        if (resp === 0) {
          await getBankCodes();
        }

        let response = await helperDisplayBankList(22, 27);
        resolve(response);
      });
    } else if (
      brokenDownText.length === 6 &&
      parseInt(brokenDownText[5], 10) === 11
    ) {
      redisClient.existsAsync(`CELDUSSD:BankCodes`).then(async resp => {
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
      `CELDUSSD:${sessionId}`,
      "menuStage"
    );
    console.log(`AT OBTAIN BANKNAME MenuStage: ${menuStage}`);
    if (
      brokenDownText.length === 3 &&
      parseInt(brokenDownText[2], 10) <= 10 &&
      menuStage == "obtainingBankInputs"
    ) {
      let selectedBankID = parseInt(brokenDownText[2], 10);
      console.log(selectedBankID);
      let selectedBankName = await redisClient.zrangeAsync(
        `CELDUSSD:BankCodes`,
        selectedBankID - 1,
        selectedBankID - 1,
        "withscores"
      );
      console.log(selectedBankName);
      await redisClient.hmsetAsync(
        `CELDUSSD:${sessionId}`,
        "bankName",
        selectedBankName[0],
        "bankCode",
        selectedBankName[1],
        "menuStage",
        "obtainingAccountNumber"
      );
      resolve("CON Enter your account number:");
    } else if (
      brokenDownText.length === 4 &&
      parseInt(brokenDownText[3], 10) <= 6 &&
      menuStage == "obtainingBankInputs"
    ) {
      let selectedBankID = parseInt(brokenDownText[3], 10) + 10;
      console.log(selectedBankID);
      let selectedBankName = await redisClient.zrangeAsync(
        `CELDUSSD:BankCodes`,
        selectedBankID - 1,
        selectedBankID - 1,
        "withscores"
      );
      console.log(selectedBankName);
      await redisClient.hmsetAsync(
        `CELDUSSD:${sessionId}`,
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
      let selectedBankID = parseInt(brokenDownText[4], 10) + 16;
      // console.log(parseInt(brokenDownText[4], 10));
      console.log(selectedBankID);
      let selectedBankName = await redisClient.zrangeAsync(
        `CELDUSSD:BankCodes`,
        selectedBankID - 1,
        selectedBankID - 1,
        "withscores"
      );
      console.log(selectedBankName);
      await redisClient.hmsetAsync(
        `CELDUSSD:${sessionId}`,
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
      let selectedBankID = parseInt(brokenDownText[5], 10) + 22;
      console.log(selectedBankID);
      let selectedBankName = await redisClient.zrangeAsync(
        `CELDUSSD:BankCodes`,
        selectedBankID - 1,
        selectedBankID - 1,
        "withscores"
      );
      console.log(selectedBankName);
      await redisClient.hmsetAsync(
        `CELDUSSD:${sessionId}`,
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
      parseInt(brokenDownText[6], 10) <= 4 &&
      menuStage == "obtainingBankInputs"
    ) {
      let selectedBankID = parseInt(brokenDownText[6], 10) + 28;
      console.log(selectedBankID);
      let selectedBankName = await redisClient.zrangeAsync(
        `CELDUSSD:BankCodes`,
        selectedBankID - 1,
        selectedBankID - 1,
        "withscores"
      );
      console.log(selectedBankName);
      await redisClient.hmsetAsync(
        `CELDUSSD:${sessionId}`,
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

async function obtainAccountNumberForDisbuseMent(brokenDownText, sessionId) {
  return new Promise(async (resolve, reject) => {
    let menuStage = await redisClient.hgetAsync(
      `CELDUSSD:${sessionId}`,
      "menuStage"
    );
    console.log(`AT OBTAIN ACCOUNT NUMBER MenuStage: ${menuStage}`);
    if (
      brokenDownText.length == 4 &&
      brokenDownText[3].length == 10 &&
      menuStage == "obtainingAccountNumber"
    ) {
      console.log("Account Number is: " + brokenDownText[3]);
      await redisClient.hmsetAsync(
        `CELDUSSD:${sessionId}`,
        "accountNumber",
        brokenDownText[3],
        "menuStage",
        "obtainingWalletPin"
      );
      resolve("CON Enter your wallet PIN:");
    } else if (
      brokenDownText.length == 5 &&
      brokenDownText[4].length == 10 &&
      menuStage == "obtainingAccountNumber"
    ) {
      console.log("Account Number is: " + brokenDownText[4]);
      await redisClient.hmsetAsync(
        `CELDUSSD:${sessionId}`,
        "accountNumber",
        brokenDownText[4],
        "menuStage",
        "obtainingWalletPin"
      );
      resolve("CON Enter your wallet PIN:");
    } else if (
      brokenDownText.length == 6 &&
      brokenDownText[5].length == 10 &&
      menuStage == "obtainingAccountNumber"
    ) {
      console.log("Account Number is: " + brokenDownText[5]);
      await redisClient.hmsetAsync(
        `CELDUSSD:${sessionId}`,
        "accountNumber",
        brokenDownText[5],
        "menuStage",
        "obtainingWalletPin"
      );
      resolve("CON Enter your wallet PIN:");
    } else if (
      brokenDownText.length == 7 &&
      brokenDownText[6].length == 10 &&
      menuStage == "obtainingAccountNumber"
    ) {
      console.log("Account Number is: " + brokenDownText[6]);
      await redisClient.hmsetAsync(
        `CELDUSSD:${sessionId}`,
        "accountNumber",
        brokenDownText[6],
        "menuStage",
        "obtainingWalletPin"
      );
      resolve("CON Enter your wallet PIN:");
    } else if (
      brokenDownText.length == 8 &&
      brokenDownText[7].length == 10 &&
      menuStage == "obtainingAccountNumber"
    ) {
      console.log("Account Number is: " + brokenDownText[7]);
      await redisClient.hmsetAsync(
        `CELDUSSD:${sessionId}`,
        "accountNumber",
        brokenDownText[7],
        "menuStage",
        "obtainingWalletPin"
      );
      resolve("CON Enter your wallet PIN:");
    } else {
      resolve("");
    }
  });
}

function formatNumber(num) {
  if (typeof num === "string") {
    num = parseInt(num, 10);
    console.log(num);
  }
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
}

module.exports = {
  processFundDisbursement
};
