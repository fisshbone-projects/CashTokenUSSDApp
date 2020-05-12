const axios = require("axios");
const { redisClient } = require("../../config/redisConnectConfig");
const { getBankCodes } = require("./directDialUtils");
const {
  formatNumber,
  DIRECTDIAL_BANK_MAP,
  getBankCharge,
} = require("../utils");
const moment = require("moment");
const { FelaMarketPlace } = require("../../config");
const { APP_PREFIX_REDIS, expireReportsInRedis } = require("../utils");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };

async function processWalletCashout(sessionId, userPhone, text) {
  let response = "";
  let brokenDownText = text.split("*");
  console.log(`BrokenDownString for ${userPhone}'s Cashout`, brokenDownText);

  if (brokenDownText.length === 4) {
    let [, amount, accountNumber, bankCode] = brokenDownText;
    let { checkAccountNumber, checkAmount, checkBankCode } = await verifyInput(
      amount,
      accountNumber,
      bankCode
    );

    if (!checkAmount.amountStatus) {
      console.log("Direct Dial: Cashout amount is invalid!");
      response = checkAmount.amountVerificationResp;
    } else if (!checkAccountNumber.accountNoStatus) {
      console.log("Direct Dial: Account Number is invalid!");
      response = checkAccountNumber.accountNoVerificationResp;
    } else if (!checkBankCode.bankCodeStatus) {
      console.log("Direct Dial: Bank Code is invalid!");
      response = checkBankCode.bankCodeVerificationResp;
    } else {
      let selectedBankName = "";
      for ([name, code] of Object.entries(DIRECTDIAL_BANK_MAP)) {
        if (bankCode === code) {
          selectedBankName = name;
        }
      }
      let selectedBankIndex = await redisClient.zrankAsync(
        "CELDUSSD:BankCodes",
        selectedBankName
      );

      let [chosenBankName, chosenBankCode] = await redisClient.zrangeAsync(
        "CELDUSSD:BankCodes",
        selectedBankIndex,
        selectedBankIndex,
        "withscores"
      );
      console.log(chosenBankCode, chosenBankName);

      await redisClient.hmsetAsync(
        `CELDUSSD:DIRECTDIAL:${sessionId}`,
        "amount",
        amount,
        "accountNumber",
        accountNumber,
        "chosenBankCode",
        chosenBankCode,
        "chosenBankName",
        chosenBankName
      );
      await redisClient.expireAsync(`CELDUSSD:DIRECTDIAL:${sessionId}`, 300);
      if ((await redisClient.existsAsync("CELDUSSD:BankCharge")) === 0) {
        await getBankCharge();
      }
      let bankCharge = await redisClient.getAsync("CELDUSSD:BankCharge");

      console.log("THis is the bank Charge", bankCharge);

      response = `CON Amount: ${formatNumber(
        amount
      )}\nBank Name: ${chosenBankName}\nAccount Number: ${accountNumber}\n(N${bankCharge} charge applies)\n\nEnter wallet PIN to Confirm\nor input 2 to Cancel`;
    }
  } else if (brokenDownText.length === 5) {
    let confirmationResp = brokenDownText[4];
    let { pinStatus } = verifyPin(confirmationResp);
    if (pinStatus) {
      let {
        amount,
        accountNumber,
        chosenBankCode,
      } = await redisClient.hgetallAsync(`CELDUSSD:DIRECTDIAL:${sessionId}`);

      response = await makeWalletWithdrawal(
        amount,
        chosenBankCode,
        accountNumber,
        userPhone,
        sessionId,
        confirmationResp
      );
    } else if (confirmationResp === "2") {
      response = "END Transaction canceled by user";
    } else {
      response = "END Wrong response inputted. Please try again";
    }
  } else {
    response = `END CashToken Direct Dial Service.\n\nDialed String does not contain the appropriate amount of information.\nPlease contact our customer care: `;
  }

  return response;
}

async function verifyInput(amount, accountNumber, bankCode) {
  let { amountStatus, amountVerificationResp } = verifyAmount(amount);
  let { accountNoStatus, accountNoVerificationResp } = verifyAccountNumber(
    accountNumber
  );
  //   let { pinStatus, pinVerificationResp } = verifyPin(pin);
  let { bankCodeStatus, bankCodeVerificationResp } = await verifyBankCode(
    bankCode
  );

  let response = {
    checkAmount: { amountStatus, amountVerificationResp },
    checkAccountNumber: { accountNoStatus, accountNoVerificationResp },
    checkBankCode: { bankCodeStatus, bankCodeVerificationResp },
  };

  return Promise.resolve(response);
}

function verifyAmount(amount) {
  let regTest = /^[0-9]*$/;
  let amountStatus = false;
  let amountVerificationResp = "";

  if (
    regTest.test(amount) &&
    parseInt(amount, 10) >= 50 &&
    parseInt(amount, 10) <= 100000
  ) {
    amountStatus = true;
  } else {
    amountStatus = false;
    if (parseInt(amount, 10) < 50 || parseInt(amount, 10) > 100000) {
      amountVerificationResp =
        "END CashToken Direct Dial Service.\n\nYou can only cahout between N50 - N100,000";
    } else {
      amountVerificationResp =
        "END CashToken Direct Dial Service.\n\nAmount inputted is not valid";
    }
  }

  return { amountStatus, amountVerificationResp };
}

function verifyAccountNumber(accountNumber) {
  let accountNoStatus = "";
  let accountNoVerificationResp = "";
  let regTest = /^[0-9]*$/;

  if (regTest.test(accountNumber) && accountNumber.length === 10) {
    accountNoStatus = true;
  } else {
    accountNoStatus = false;
    accountNoVerificationResp =
      "END CashToken Direct Dial Service.\n\nAccount number inputed is not valid";
  }
  return { accountNoStatus, accountNoVerificationResp };
}

function verifyPin(pin) {
  let pinStatus = "";
  let pinVerificationResp = "";
  let regTest = /^[0-9]*$/;

  if (regTest.test(pin) && pin.length >= 4 && pin.length <= 12) {
    pinStatus = true;
  } else {
    pinStatus = false;
    pinVerificationResp =
      "END CashToken Direct Dial Service.\n\nPIN inputed is not a valid PIN";
  }
  return { pinStatus, pinVerificationResp };
}

async function verifyBankCode(bankCode) {
  return new Promise(async (resolve) => {
    let { bankNames, bankCodes } = await getBankCodeDetails();
    // console.log("Checking", bankNames, bankCodes);
    let bankCodeStatus = "";
    let bankCodeVerificationResp = "";

    let regTest = /^[0-9]*$/;

    if (regTest.test(bankCode) && bankCode.length === 3) {
      for ([name, code] of Object.entries(DIRECTDIAL_BANK_MAP)) {
        if (bankCode === code) {
          bankCodeStatus = true;
        }
      }
      if (bankCodeStatus === "") {
        bankCodeStatus = false;
        bankCodeVerificationResp =
          "END CashToken Direct Dial Service.\n\nBank code inputted does not exist";
      }
    } else {
      bankCodeStatus = false;
      bankCodeVerificationResp =
        "END CashToken Direct Dial Service.\n\nBank code inputted is not valid";
    }

    resolve({ bankCodeStatus, bankCodeVerificationResp });
  });
}

async function getBankCodeDetails() {
  let checkForBankCode = await redisClient.existsAsync("CELDUSSD:BankCodes");
  if (checkForBankCode === 0) await getBankCodes();
  let listOfBankCodes = await redisClient.zrangeAsync(
    `CELDUSSD:BankCodes`,
    0,
    -1,
    "withscores"
  );

  let bankNames = listOfBankCodes.filter((bank) => {
    return !/^[0-9]*$/.test(bank);
  });

  let bankCodes = listOfBankCodes.filter((bank) => {
    return /^[0-9]*$/.test(bank);
  });

  let sanitizedBankCodes = bankCodes.map((bank) => {
    let newCode = bank.length === 2 ? `0${bank}` : bank;
    return newCode;
  });

  return Promise.resolve({ bankNames, bankCodes: sanitizedBankCodes });
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
          `${APP_PREFIX_REDIS}:reports:count:purchases_DirectDial_WalletCashout:${moment().format(
            "DMMYYYY"
          )}`
        );
        // expireReportsInRedis(
        //   `${APP_PREFIX_REDIS}:reports:count:purchases_DirectDial_WalletCashout:${moment().format(
        //     "DMMYYYY"
        //   )}`
        // );

        await redisClient.incrbyAsync(
          `${APP_PREFIX_REDIS}:reports:count:totalValue_DirectDial_WalletCashout:${moment().format(
            "DMMYYYY"
          )}`,
          parseInt(amount)
        );
        // expireReportsInRedis(
        //   `${APP_PREFIX_REDIS}:reports:count:totalValue_DirectDial_WalletCashout:${moment().format(
        //     "DMMYYYY"
        //   )}`
        // );
        console.log(response.data);
        let feedback = `END Dear Customer, Your Account will be credited within 24 hours`;
        resolve(feedback);
      })
      .catch((error) => {
        console.log("error");
        // console.log(error);
        console.log(JSON.stringify(error.response.data, null, 2));
        let feedback = `END Transaction Failed!`;
        if (error.response.data.message.includes("Insufficient user balance")) {
          feedback += `\nInsufficient user balance in wallet`;
        } else if (
          error.response.data.message.includes("authentication failed")
        ) {
          feedback = `Process failed!\n${error.response.data.response.body.message}`;
        }
        resolve(feedback);
      });
  });
}

module.exports = {
  processWalletCashout,
};
