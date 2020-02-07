const { check, validationResult } = require("express-validator");
const { redisClient } = require("../redisConnectConfig");
const axios = require("axios");
const { FelaMarketPlace } = require("../../config");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };

const BANK_NAME_ABR = {
  "First Bank Plc": "First Bank",
  "Afribank Nigeria Plc": "Afribank",
  "Heritage Bank": "Heritage",
  "Union Bank Of Nigeria Plc": "Union Bank",
  "United Bank For Africa Plc": "UBA",
  "Wema Bank Plc": "Wema",
  "Access Bank Nigeria": "Access",
  "Ecobank Nigeria Limited": "Ecobank",
  "Zenith Bank Plc": "Zenith",
  "Gtbank Plc": "GTB",
  "Access Bank Plc Diamond": "Access-Diamond",
  "Standard Chartered Bank Nigeria Limited": "Standard Chartered Bank",
  "Fidelity Bank Plc": "Fidelity",
  "Polaris Bank Plc": "Polaris",
  "Keystone Bank Plc": "Keystone",
  "Enterprise Bank Limited": "Enterprise",
  "Providus Bank": "Providus",
  "First City Monument Bank Plc": "First City Monument Bank",
  "Unity Bank Plc": "Unity",
  "Stanbic Ibtc Bank Plc": "Stanbic Ibtc",
  "Sterling Bank Plc": "Sterling",
  "Stanbic Mobile": "Stanbic Mobile",
  Paycom: "Paycom",
  "Ecobank Mobile": "Ecobank Mobile",
  "Fbn Mobile": "Fbn Mobile",
  Parkway: "Parkway",
  "Gtbank Mobile Money": "GTB Mobile Money",
  "Zenith Mobile": "Zenith Mobile",
  "Access Mobile": "Access Mobile",
  "Aso Savings And Loans": "Aso Savings and Loans",
  "Parralex Bank": "Parralex",
  "Coronation Merchant Bank": "Coronation Merchant Bank"
};

Object.freeze(BANK_NAME_ABR);

const DIRECTDIAL_BANK_MAP = {
  "Access Bank Nigeria": "901",
  "United Bank For Africa Plc": "919",
  "Gtbank Plc": "737",
  "Zenith Bank Plc": "966",
  "Ecobank Nigeria Limited": "326",
  "Sterling Bank Plc": "822",
  "Fidelity Bank Plc": "770",
  "Union Bank Of Nigeria Plc": "826",
  "Wema Bank Plc": "945",
  "Keystone Bank Plc": "777",
  "Stanbic Ibtc Bank Plc": "909",
  "First Bank Plc": "894",
  "Unity Bank Plc": "799"
};
Object.freeze(DIRECTDIAL_BANK_MAP);

const MYBANKUSSD_BANK_CODES = {
  Access: "901",
  UBA: "919",
  GTB: "737",
  Zenith: "966",
  Ecobank: "326",
  Sterling: "822",
  Fidelity: "770",
  Union: "826",
  WEMA: "945",
  Keystone: "777",
  Stanbic: "909",
  FBN: "894",
  Unity: "799"
};

Object.freeze(MYBANKUSSD_BANK_CODES);

const MYBANKUSSD_SERVICE_CODES = {
  airtime: "02",
  electicity: "03",
  cashtoken: "01",
  cableTvDSTV: "14",
  cableTvGOTV: "15",
  cableTvStarTimes: "16"
};

Object.freeze(MYBANKUSSD_SERVICE_CODES);

const MYBANKUSSD_BASE_CODE = "000*111";

const WalletTypes = {
  "myFela Top-Up": "FELA Wallet",
  iSavings: "iSavings",
  "Guaranteed Cashback": "Instant Cash-back",
  Wins: "Draw Win Balance"
};

Object.freeze(WalletTypes);

function createValidationFor(route) {
  switch (route) {
    case "ussd":
      return [
        check("sessionId")
          .exists()
          .withMessage("Parameter sessionId is not included in your request")
          .custom(sessionId => {
            if (sessionId == null || sessionId.length < 1) {
              return Promise.reject("Session ID is not valid");
            } else {
              return Promise.resolve();
            }
          }),
        check("phoneNumber")
          .exists()
          .withMessage("Parameter phoneNumber is not included in your request")
          .custom(phoneNumber => {
            if (!testNumber(phoneNumber)) {
              return Promise.reject("Phone Number is not valid");
            } else {
              return Promise.resolve();
            }
          }),
        check("text")
          .exists()
          .withMessage("Parameter text is not included in your request")
          .custom(text => {
            if (typeof text === "string") {
              return Promise.resolve();
            } else {
              return Promise.reject("Text can be a string only");
            }
          }),
        check("serviceCode")
          .exists()
          .withMessage("Parameter serviceCode is not included in your request")
          .custom(serviceCode => {
            if (
              serviceCode == "*347*999#" ||
              serviceCode == "*384*24222#" ||
              serviceCode === "*384*24223#"
            ) {
              return Promise.resolve();
            } else {
              return Promise.reject(
                "Only serviceCode *347*999# is serviced by this API"
              );
            }
          })
      ];
    default:
      return [];
  }
}

function checkValidationResult(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) {
    return next();
  }

  res.status(422).json({ error: result.array() });
}

function testNumber(phoneNumber) {
  let regPhone1 = /^[+]{0,1}(234){1}[0-9]{10}$/;
  let regPhone2 = /^[0-9]{11}$/;

  let phoneNumberTest =
    regPhone1.test(phoneNumber) || regPhone2.test(phoneNumber);

  return phoneNumberTest;
}

async function storeInternalLog(req, response, inputedText) {
  let { phoneNumber, sessionId, serviceCode } = req.body;
  let { host: client, "user-agent": clientAgent } = req.headers;
  let date = new Date();
  let date_time = `${date.toDateString()} ${date
    .toTimeString()
    .substring(0, 8)}`;
  let responseLowerCase = response.toLowerCase();
  let responseStatus = "";

  if (
    responseLowerCase.includes("sorry") ||
    responseLowerCase.includes("error") ||
    responseLowerCase.includes("failed")
  ) {
    responseStatus = response.substring(4);
  } else {
    responseStatus = "Got expected response from the server";
  }

  let logs = [
    "request_caller",
    `${clientAgent ? `${clientAgent}` : `${client}`}`,
    "service_code",
    `${serviceCode}`,
    "session_id",
    `${sessionId}`,
    "client",
    `${phoneNumber}`,
    "request_body",
    `${inputedText}`,
    "server_response_status",
    `${responseStatus}`
  ];

  redisClient.rpushAsync("CELDUSSD:InternalLogs:Keys", date_time).then(resp => {
    redisClient
      .hmsetAsync("CELDUSSD:InternalLogs", date_time, JSON.stringify(logs))
      .then(resp => {
        return Promise.resolve();
      });
  });
}

async function getBankCharge() {
  return new Promise(resolve => {
    axios
      .get(
        `${FelaMarketPlace.BASE_URL}/info/felaWalletCharge?chargeType=transfer`,
        {
          headers: felaHeader
        }
      )
      .then(async response => {
        await redisClient.setAsync(
          "CELDUSSD:BankCharge",
          response.data.data.fee
        );
        await redisClient.expireAsync("CELDUSSD:BankCharge", 360); //Cache for 1 hour
        resolve();
      })
      .catch(e => {
        console.loe("There was an error retrieving bank charge");
        console.log(e);
      });
  });
}

function checkPinForRepetition(pin) {
  let initialDigit = pin[0];
  let pinRepeating = false;

  [...`${pin}`].forEach(digit => {
    pinRepeating = digit === initialDigit;
  });
  return pinRepeating;
}
function formatNumber(num) {
  if (typeof num === "string") {
    num = parseInt(num, 10);
    // console.log(num);
  }
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
}

function refineText(text) {
  let splittedText = text.split("*");
  let newText = "";
  let backToMainMenu = false;
  let backToMainMenuIndex = 0;
  let backOneStep = false;
  let backOneStepIndex = 0;

  for (let i = splittedText.length - 1; i > 0; i--) {
    if (splittedText[i] === "0") {
      backToMainMenu = true;
      backToMainMenuIndex = i;
      break;
    } else if (splittedText[i] === "#") {
      backOneStep = true;
      backOneStepIndex = i;
      break;
    }
  }

  if (backToMainMenu) {
    if (splittedText[backToMainMenuIndex + 1] === undefined) {
      newText = "";
    } else {
      let newSplitArray = splittedText.splice(backToMainMenuIndex + 1);
      newText = newSplitArray.join("*");
    }
  } else if (backOneStep) {
    if (splittedText[backOneStepIndex + 1] === undefined) {
      let newSplitArray = splittedText.filter(value => {
        return value !== "#";
      });
      console.log(newSplitArray);

      let finalSplitArray = newSplitArray.slice();
      for (let i = 0; i < newSplitArray.length; i++) {
        console.log("I'm popping");
        finalSplitArray.pop();
      }
      newText = finalSplitArray.join("*");
    } else {
      let newSplitArray = splittedText.splice(backOneStepIndex + 1);
      newText = newSplitArray.join("*");
    }
  } else {
    newText = text;
  }
  return newText;
}

module.exports = {
  BANK_NAME_ABR,
  WalletTypes,
  createValidationFor,
  checkValidationResult,
  storeInternalLog,
  refineText,
  testNumber,
  checkPinForRepetition,
  formatNumber,
  DIRECTDIAL_BANK_MAP,
  getBankCharge,
  MYBANKUSSD_BANK_CODES,
  MYBANKUSSD_SERVICE_CODES,
  MYBANKUSSD_BASE_CODE
};
