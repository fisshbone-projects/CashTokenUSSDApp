const { redisClient } = require("../redisConnectConfig");
const { FelaMarketPlace, App } = require("../index");
const {
  APP_PREFIX_REDIS,
  formatNumber,
  MYBANKUSSD_BANK_CODES
} = require("../utils");
const moment = require("moment");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
const API_DATA_EXPIRE_TIME = parseInt(App.REDIS_API_DATA_EXPIRE);

async function processCableTv(phoneNumber, text, sessionId) {
  let { cableProviderName, cableProviderCode } = await redisClient.hgetallAsync(
    `${APP_PREFIX_REDIS}:${sessionId}`
  );

  return new Promise(async (resolve, reject) => {
    console.log("Starting the CableTV bill payment process");
    let brokenDownText = text.split("*");

    let response = await menuFlowDisplayProviders(brokenDownText);
    if (response !== "") {
      resolve(response);
    } else {
      response = await menuFlowDisplayBouquets(brokenDownText, sessionId);
      if (response !== "") {
        resolve(response);
      } else {
        response = await menuFlowDisplayOverFlowBouquets(
          brokenDownText,
          sessionId,
          cableProviderCode,
          cableProviderName
        );
        if (response !== "") {
          resolve(response);
        } else {
          response = await menuFlowGetSmartCardNo(
            brokenDownText,
            sessionId,
            cableProviderCode,
            cableProviderName
          );
          if (response !== "") {
            resolve(response);
          } else {
            response = await menuFlowGetPaymentMethod(
              brokenDownText,
              sessionId,
              cableProviderCode,
              cableProviderName
            );

            if (response !== "") {
              resolve(response);
            } else {
              response = await menuFlowGetPaymentDetails(
                brokenDownText,
                sessionId,
                cableProviderName
              );
              if (response !== "") {
                resolve(response);
              } else {
                response = await menuFlowDisplaySummary(
                  brokenDownText,
                  sessionId,
                  cableProviderName
                );
                if (response !== "") {
                  resolve(response);
                } else {
                  response = await menuFlowMakePayment(
                    phoneNumber,
                    brokenDownText,
                    sessionId,
                    cableProviderName
                  );
                  if (response !== "") {
                    resolve(response);
                  } else {
                    response = `CON Error!\nInvalid input\n\nEnter 0 to start over`;
                    resolve(response);
                  }
                }
              }
            }
          }
        }
      }
    }
  });
}

async function menuFlowDisplayProviders(brokenDownText) {
  return new Promise(async resolve => {
    let response = "";
    if (brokenDownText.length === 2) {
      await redisClient.incrAsync(
        `${APP_PREFIX_REDIS}:reports:count:subMenu_PayForCableTV:${moment().format(
          "DMMYYYY"
        )}`
      );
      response = await displayCableProviders();
      resolve(response);
    } else {
      resolve("");
    }
  });
}

async function menuFlowDisplayBouquets(brokenDownText, sessionId) {
  return new Promise(async resolve => {
    let response = "";

    if (brokenDownText.length === 3) {
      let selectedProvider = Number(brokenDownText[2]);
      if (
        selectedProvider <=
        (await redisClient.zcardAsync(`${APP_PREFIX_REDIS}:CableTVProviders`))
      ) {
        let [providerName, providerCode] = await redisClient.zrangeAsync(
          `${APP_PREFIX_REDIS}:CableTVProviders`,
          selectedProvider - 1,
          selectedProvider - 1,
          "withscores"
        );

        console.log("Checking this: ", providerName, providerCode);

        await redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "cableProviderName",
          `${providerName}`,
          "cableProviderCode",
          `${providerCode}`
        );

        switch (providerName) {
          case "DSTV":
            response = await displayBouquets(providerCode, providerName, 0, 5);
            await redisClient.hset(
              `${APP_PREFIX_REDIS}:${sessionId}`,
              "ussdState",
              "getSmartCardNumber"
            );
            resolve(response);
            break;
          case "GOTV":
            response = await displayBouquets(providerCode, providerName, 0, -1);
            await redisClient.hset(
              `${APP_PREFIX_REDIS}:${sessionId}`,
              "ussdState",
              "getSmartCardNumber"
            );
            resolve(response);
            break;
          default:
            response = `CON Bouquet not available at the moment for this provider.\nPlease check again soon.\n\n 0 Menu`;
        }
      } else {
        response =
          "CON Error!\nSelect a valid cable provider\n\nEnter 0 to start over";
        resolve(response);
      }
    } else {
      response = "";
      resolve(response);
    }
  });
}

async function menuFlowDisplayOverFlowBouquets(
  brokenDownText,
  sessionId,
  providerCode,
  providerName
) {
  return new Promise(async resolve => {
    let response = "";

    switch (providerName) {
      case "DSTV":
        if (brokenDownText.length === 4 && brokenDownText[3] === "7") {
          response = await displayBouquets(providerCode, providerName, 6, 11);
          await redisClient.hset(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "ussdState",
            "getSmartCardNumber"
          );
          resolve(response);
        } else if (brokenDownText.length === 5 && brokenDownText[4] === "7") {
          response = await displayBouquets(providerCode, providerName, 12, -1);
          await redisClient.hset(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "ussdState",
            "getSmartCardNumber"
          );
          resolve(response);
        }
        break;
    }

    resolve(response);
  });
}

async function menuFlowGetSmartCardNo(
  brokenDownText,
  sessionId,
  providerCode,
  providerName
) {
  return new Promise(async resolve => {
    let response = "";
    let currentState = await redisClient.hgetAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`,
      "ussdState"
    );

    console.log("CableTV State", currentState);

    switch (providerName) {
      case "DSTV":
        if (
          brokenDownText.length === 4 &&
          Number(brokenDownText[3]) <= 6 &&
          currentState === "getSmartCardNumber"
        ) {
          let selectedBouquet = parseInt(brokenDownText[3]);
          saveSelectedBouquet(providerCode, selectedBouquet - 1, sessionId);
          await redisClient.hset(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "ussdState",
            "getPaymentMethod"
          );

          response = `CON Enter your SmartCard Number:`;
          resolve(response);
        } else if (
          brokenDownText.length === 5 &&
          Number(brokenDownText[4]) <= 6 &&
          currentState === "getSmartCardNumber"
        ) {
          let selectedBouquet = parseInt(brokenDownText[4]);
          saveSelectedBouquet(providerCode, selectedBouquet + 5, sessionId);
          await redisClient.hset(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "ussdState",
            "getPaymentMethod"
          );
          response = `CON Enter your SmartCard Number:`;
          resolve(response);
        } else if (
          brokenDownText.length === 6 &&
          Number(brokenDownText[5]) <= 7 &&
          currentState === "getSmartCardNumber"
        ) {
          let selectedBouquet = parseInt(brokenDownText[5]);
          saveSelectedBouquet(providerCode, selectedBouquet + 11, sessionId);
          await redisClient.hset(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "ussdState",
            "getPaymentMethod"
          );
          response = `CON Enter your SmartCard Number:`;
          resolve(response);
        }
        break;
      case "GOTV":
        if (
          brokenDownText.length === 4 &&
          Number(brokenDownText[3]) <= 6 &&
          currentState === "getSmartCardNumber"
        ) {
          let selectedBouquet = parseInt(brokenDownText[3]);
          saveSelectedBouquet(providerCode, selectedBouquet - 1, sessionId);
          await redisClient.hset(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "ussdState",
            "getPaymentMethod"
          );
          response = `CON Enter your SmartCard Number:`;
          resolve(response);
        }
    }

    resolve(response);
  });
}

async function menuFlowGetPaymentMethod(
  brokenDownText,
  sessionId,
  providerCode,
  providerName
) {
  return new Promise(async resolve => {
    let response = "";
    let currentState = await redisClient.hgetAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`,
      "ussdState"
    );

    switch (providerName) {
      case "DSTV":
        if (
          brokenDownText.length === 5 &&
          brokenDownText[4].length > 5 &&
          currentState === "getPaymentMethod"
        ) {
          let {
            cableBouquetCode: bouquetCode
          } = await redisClient.hgetallAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`
          );

          let smartCardNo = brokenDownText[4];
          if (
            await confirmSmartCardNo(smartCardNo, providerCode, bouquetCode)
          ) {
            await redisClient.hmsetAsync(
              `${APP_PREFIX_REDIS}:${sessionId}`,
              "ussdState",
              "getPaymentDetails",
              "cableCardNo",
              smartCardNo
            );
            response = `CON Select payment method:\n1 My Wallet\n2 MyBankUSSD`;
            resolve(response);
          } else {
            response = `CON Error!\nInputed smartcard number cannot be verified \n\nEnter 0 to start over`;
            resolve(response);
          }
        } else if (
          brokenDownText.length === 6 &&
          brokenDownText[5].length > 5 &&
          currentState === "getPaymentMethod"
        ) {
          let {
            cableBouquetCode: bouquetCode
          } = await redisClient.hgetallAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`
          );

          let smartCardNo = brokenDownText[5];
          if (
            await confirmSmartCardNo(smartCardNo, providerCode, bouquetCode)
          ) {
            await redisClient.hmsetAsync(
              `${APP_PREFIX_REDIS}:${sessionId}`,
              "ussdState",
              "getPaymentDetails",
              "cableCardNo",
              smartCardNo
            );
            response = `CON Select payment method:\n1 My Wallet\n2 MyBankUSSD`;
            resolve(response);
          } else {
            response = `CON Error!\nInputed smartcard number cannot be verified \n\nEnter 0 to start over`;
            resolve(response);
          }
        } else if (
          brokenDownText.length === 7 &&
          brokenDownText[6].length > 5 &&
          currentState === "getPaymentMethod"
        ) {
          let {
            cableBouquetCode: bouquetCode
          } = await redisClient.hgetallAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`
          );

          let smartCardNo = brokenDownText[6];
          if (
            await confirmSmartCardNo(smartCardNo, providerCode, bouquetCode)
          ) {
            await redisClient.hmsetAsync(
              `${APP_PREFIX_REDIS}:${sessionId}`,
              "ussdState",
              "getPaymentDetails",
              "cableCardNo",
              smartCardNo
            );
            response = `CON Select payment method:\n1 My Wallet\n2 MyBankUSSD`;
            resolve(response);
          } else {
            response = `CON Error!\nInputed smartcard number cannot be verified \n\nEnter 0 to start over`;
            resolve(response);
          }
        }
        break;
      case "GOTV":
        if (
          brokenDownText.length === 5 &&
          currentState === "getPaymentMethod"
        ) {
          let {
            cableBouquetCode: bouquetCode
          } = await redisClient.hgetallAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`
          );

          let smartCardNo = brokenDownText[4];
          if (
            await confirmSmartCardNo(smartCardNo, providerCode, bouquetCode)
          ) {
            await redisClient.hmsetAsync(
              `${APP_PREFIX_REDIS}:${sessionId}`,
              "ussdState",
              "getPaymentDetails",
              "cableCardNo",
              smartCardNo
            );
            response = `CON Select payment method:\n1 My Wallet\n2 MyBankUSSD`;
            resolve(response);
          } else {
            response = `CON Error!\nInputed smartcard number cannot be verified \n\nEnter 0 to start over`;
            resolve(response);
          }
        }
    }

    resolve(response);
  });
}

async function menuFlowGetPaymentDetails(
  brokenDownText,
  sessionId,
  providerName
) {
  return new Promise(async resolve => {
    let response = "";
    let currentState = await redisClient.hgetAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`,
      "ussdState"
    );

    switch (providerName) {
      case "DSTV":
        if (
          (brokenDownText.length === 6 ||
            brokenDownText.length === 7 ||
            brokenDownText.length === 8) &&
          currentState === "getPaymentDetails"
        ) {
          let paymentMethod = "";
          if (brokenDownText.length === 6) {
            paymentMethod = brokenDownText[5];
          } else if (brokenDownText.length === 7) {
            paymentMethod = brokenDownText[6];
          } else if (brokenDownText.length === 8) {
            paymentMethod = brokenDownText[7];
          }

          if (paymentMethod === "1" || paymentMethod === "2") {
            if (paymentMethod === "1") {
              await redisClient.hmsetAsync(
                `${APP_PREFIX_REDIS}:${sessionId}`,
                "paymentMethod",
                "felawallet",
                "ussdState",
                "displaySummary"
              );

              response = "CON Enter your wallet PIN:";
              resolve(response);
            } else {
              await redisClient.hmsetAsync(
                `${APP_PREFIX_REDIS}:${sessionId}`,
                "paymentMethod",
                "coralpay",
                "ussdState",
                "displaySummary"
              );
              response = displayMyBankUSSDBanks();
              resolve(response);
            }
          } else {
            response =
              "CON Error!\nSelect a valid payment method\n\nEnter 0 to start over";
            resolve(response);
          }
        }

        break;

      case "GOTV":
        if (
          brokenDownText.length === 6 &&
          currentState === "getPaymentDetails"
        ) {
          let paymentMethod = brokenDownText[5];

          if (paymentMethod === "1" || paymentMethod === "2") {
            if (paymentMethod === "1") {
              await redisClient.hmsetAsync(
                `${APP_PREFIX_REDIS}:${sessionId}`,
                "paymentMethod",
                "felawallet",
                "ussdState",
                "displaySummary"
              );
              response = "CON Enter your wallet PIN:";
              resolve(response);
            } else {
              await redisClient.hmsetAsync(
                `${APP_PREFIX_REDIS}:${sessionId}`,
                "paymentMethod",
                "coralpay",
                "ussdState",
                "displaySummary"
              );
              response = displayMyBankUSSDBanks();
              resolve(response);
            }
          } else {
            response =
              "CON Error!\nSelect a valid payment method\n\nEnter 0 to start over";
            resolve(response);
          }
        }
        break;
    }

    resolve(response);
  });
}

async function menuFlowDisplaySummary(brokenDownText, sessionId, providerName) {
  return new Promise(async resolve => {
    let response = "";
    let {
      ussdState: currentState,
      paymentMethod
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

    switch (providerName) {
      case "DSTV":
        if (
          (brokenDownText.length === 7 ||
            brokenDownText.length === 8 ||
            brokenDownText.length === 9) &&
          currentState === "displaySummary" &&
          paymentMethod === "felawallet"
        ) {
          let walletPin = "";

          if (brokenDownText.length === 7) {
            walletPin = brokenDownText[6];
          } else if (brokenDownText.length === 8) {
            walletPin = brokenDownText[7];
          } else if (brokenDownText.length === 9) {
            walletPin = brokenDownText[8];
          }

          if (/^[0-9]*$/.test(walletPin)) {
            await redisClient.hmsetAsync(
              `${APP_PREFIX_REDIS}:${sessionId}`,
              "walletPin",
              `${walletPin}`,
              "ussdState",
              "makePayment"
            );

            let {
              cableProviderName,
              cableBouquetName,
              cableCardNo,
              bouquetPrice
            } = await redisClient.hgetallAsync(
              `${APP_PREFIX_REDIS}:${sessionId}`
            );
            response = `CON Confirm CableTV Payment:\nProvider: ${cableProviderName}\nBouquet: ${cableBouquetName}\nCardNo: ${cableCardNo}\nPrice: ${formatNumber(
              bouquetPrice
            )}\nPayMethod: Wallet\n\n1 Confirm\n2 Cancel`;
            resolve(response);
          } else {
            console.log("PIN is invalid");
            response = `CON Error!\nPIN can only be numbers\n\nEnter 0 to start over`;
            resolve(response);
          }
        } else if (
          (brokenDownText.length === 7 ||
            brokenDownText.length === 8 ||
            brokenDownText.length === 9) &&
          currentState === "displaySummary" &&
          paymentMethod === "coralpay"
        ) {
          let {
            cableProviderName,
            cableBouquetName,
            cableCardNo,
            bouquetPrice
          } = await redisClient.hgetallAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`
          );

          let chosenUSSDBank = "";

          if (brokenDownText.length === 7) {
            chosenUSSDBank = parseInt(brokenDownText[6], 10);
          } else if (brokenDownText.length === 8) {
            chosenUSSDBank = parseInt(brokenDownText[7], 10);
          } else if (brokenDownText.length === 9) {
            chosenUSSDBank = parseInt(brokenDownText[8], 10);
          }

          let chosenUSSDBankName = Object.keys(MYBANKUSSD_BANK_CODES)[
            chosenUSSDBank - 1
          ];
          let chosenUSSDBankCode = Object.values(MYBANKUSSD_BANK_CODES)[
            chosenUSSDBank - 1
          ];
          await redisClient.hmsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "chosenUSSDBankName",
            chosenUSSDBankName,
            "chosenUSSDBankCode",
            chosenUSSDBankCode,
            "ussdState",
            "makePayment"
          );

          response = `CON Confirm CableTV Payment:\nProvider: ${cableProviderName}\nBouquet: ${cableBouquetName}\nCardNo: ${cableCardNo}\nPrice: ${formatNumber(
            bouquetPrice
          )}\nPayMethod: ${
            chosenUSSDBankName.includes("bank") ||
            chosenUSSDBankName == "GTB" ||
            chosenUSSDBankName == "FBN" ||
            chosenUSSDBankName == "UBA"
              ? chosenUSSDBankName
              : `${chosenUSSDBankName}`
          }\n\n1 Confirm\n2 Cancel`;
          resolve(response);
        }
        break;

      case "GOTV":
        if (
          brokenDownText.length === 7 &&
          currentState === "displaySummary" &&
          paymentMethod === "felawallet"
        ) {
          let walletPin = brokenDownText[6];
          if (/^[0-9]*$/.test(walletPin)) {
            await redisClient.hmsetAsync(
              `${APP_PREFIX_REDIS}:${sessionId}`,
              "walletPin",
              `${walletPin}`,
              "ussdState",
              "makePayment"
            );

            let {
              cableProviderName,
              cableBouquetName,
              cableCardNo,
              bouquetPrice
            } = await redisClient.hgetallAsync(
              `${APP_PREFIX_REDIS}:${sessionId}`
            );
            response = `CON Confirm CableTV Payment:\nProvider: ${cableProviderName}\nBouquet: ${cableBouquetName}\nCardNo: ${cableCardNo}\nPrice: ${formatNumber(
              bouquetPrice
            )}\nPayMethod: Wallet\n\n1 Confirm\n2 Cancel`;
            resolve(response);
          } else {
            console.log("PIN is invalid");
            response = `CON Error!\nPIN can only be numbers\n\nEnter 0 to start over`;
            resolve(response);
          }
        } else if (
          brokenDownText.length === 7 &&
          currentState === "displaySummary" &&
          paymentMethod === "coralpay"
        ) {
          let {
            cableProviderName,
            cableBouquetName,
            cableCardNo,
            bouquetPrice
          } = await redisClient.hgetallAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`
          );

          let chosenUSSDBank = parseInt(brokenDownText[6], 10);
          let chosenUSSDBankName = Object.keys(MYBANKUSSD_BANK_CODES)[
            chosenUSSDBank - 1
          ];
          let chosenUSSDBankCode = Object.values(MYBANKUSSD_BANK_CODES)[
            chosenUSSDBank - 1
          ];
          await redisClient.hmsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "chosenUSSDBankName",
            chosenUSSDBankName,
            "chosenUSSDBankCode",
            chosenUSSDBankCode,
            "ussdState",
            "makePayment"
          );

          response = `CON Confirm CableTV Payment:\nProvider: ${cableProviderName}\nBouquet: ${cableBouquetName}\nCardNo: ${cableCardNo}\nPrice: ${formatNumber(
            bouquetPrice
          )}\nPayMethod: ${
            chosenUSSDBankName.includes("bank") ||
            chosenUSSDBankName == "GTB" ||
            chosenUSSDBankName == "FBN" ||
            chosenUSSDBankName == "UBA"
              ? chosenUSSDBankName
              : `${chosenUSSDBankName}`
          }\n\n1 Confirm\n2 Cancel`;
          resolve(response);
        }
        break;
    }

    resolve(response);
  });
}

async function menuFlowMakePayment(
  phoneNumber,
  brokenDownText,
  sessionId,
  providerName
) {
  return new Promise(async resolve => {
    let response = "";
    let {
      ussdState: currentState,
      paymentMethod
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

    switch (providerName) {
      case "DSTV":
        if (
          ((brokenDownText.length === 8 && brokenDownText[7] === "1") ||
            (brokenDownText.length === 9 && brokenDownText[8] === "1") ||
            (brokenDownText.length === 10 && brokenDownText[9] === "1")) &&
          currentState === "makePayment" &&
          paymentMethod === "felawallet"
        ) {
          let {
            cableProviderCode,
            cableCardNo,
            cableBouquetCode,
            paymentMethod,
            walletPin
          } = await redisClient.hgetallAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`
          );

          response = await processCableTVPayment(
            sessionId,
            phoneNumber,
            cableCardNo,
            cableProviderCode,
            cableBouquetCode,
            paymentMethod,
            walletPin
          );

          resolve(response);
        } else if (
          ((brokenDownText.length === 8 && brokenDownText[7] === "1") ||
            (brokenDownText.length === 9 && brokenDownText[8] === "1") ||
            (brokenDownText.length === 10 && brokenDownText[9] === "1")) &&
          currentState === "makePayment" &&
          paymentMethod === "coralpay"
        ) {
          let {
            cableProviderCode,
            cableCardNo,
            cableBouquetCode,
            paymentMethod,
            chosenUSSDBankCode
          } = await redisClient.hgetallAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`
          );

          response = await processCableTVPayment(
            sessionId,
            phoneNumber,
            cableCardNo,
            cableProviderCode,
            cableBouquetCode,
            paymentMethod,
            undefined,
            chosenUSSDBankCode
          );

          resolve(response);
        } else if (
          ((brokenDownText.length === 8 && brokenDownText[7] === "2") ||
            (brokenDownText.length === 9 && brokenDownText[8] === "2") ||
            (brokenDownText.length === 10 && brokenDownText[9] === "2")) &&
          currentState === "makePayment" &&
          (paymentMethod === "felawallet" || paymentMethod === "coralpay")
        ) {
          response = `CON Transaction canceled by user.\n\n0 Menu`;
          resolve(response);
        }

        break;
      case "GOTV":
        if (
          brokenDownText.length === 8 &&
          brokenDownText[7] === "1" &&
          currentState === "makePayment" &&
          paymentMethod === "felawallet"
        ) {
          let {
            cableProviderCode,
            cableCardNo,
            cableBouquetCode,
            paymentMethod,
            walletPin
          } = await redisClient.hgetallAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`
          );

          response = await processCableTVPayment(
            sessionId,
            phoneNumber,
            cableCardNo,
            cableProviderCode,
            cableBouquetCode,
            paymentMethod,
            walletPin
          );

          resolve(response);
        } else if (
          brokenDownText.length === 8 &&
          brokenDownText[7] === "1" &&
          currentState === "makePayment" &&
          paymentMethod === "coralpay"
        ) {
          let {
            cableProviderCode,
            cableCardNo,
            cableBouquetCode,
            paymentMethod,
            chosenUSSDBankCode
          } = await redisClient.hgetallAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`
          );

          response = await processCableTVPayment(
            sessionId,
            phoneNumber,
            cableCardNo,
            cableProviderCode,
            cableBouquetCode,
            paymentMethod,
            undefined,
            chosenUSSDBankCode
          );

          resolve(response);
        } else if (
          brokenDownText.length === 8 &&
          brokenDownText[7] === "2" &&
          currentState === "makePayment" &&
          (paymentMethod === "felawallet" || paymentMethod === "coralpay")
        ) {
          response = `CON Transaction canceled by user.\n\n0 Menu`;
          resolve(response);
        }

        break;
    }

    resolve(response);
  });
}

async function saveSelectedBouquet(providerCode, selectedBouquet, sessionId) {
  return new Promise(async resolve => {
    let [selectedBouquetName, bouquetPrice] = await redisClient.zrevrangeAsync(
      `${APP_PREFIX_REDIS}:CableTVBouquet:${providerCode}:Name`,
      selectedBouquet,
      selectedBouquet,
      "withscores"
    );
    let [selectedBouquetCode] = await redisClient.zrevrangeAsync(
      `${APP_PREFIX_REDIS}:CableTVBouquet:${providerCode}:Code`,
      selectedBouquet,
      selectedBouquet
    );

    console.log(
      "Bouquet Details",
      selectedBouquetName,
      selectedBouquetCode,
      bouquetPrice
    );
    redisClient.hmset(
      `${APP_PREFIX_REDIS}:${sessionId}`,
      "cableBouquetName",
      `${selectedBouquetName}`,
      "cableBouquetCode",
      `${selectedBouquetCode}`,
      "bouquetPrice",
      `${bouquetPrice}`
    );

    resolve();
  });
}

async function confirmSmartCardNo(smartCardNo, providerCode, bouquetCode) {
  return new Promise(resolve => {
    console.log(smartCardNo, providerCode, bouquetCode);
    axios
      .get(
        `${FelaMarketPlace.BASE_URL}/info/tvSmartCard?number=${smartCardNo}&provider_code=${providerCode}&service_code=${bouquetCode}
        `,
        {
          headers: {
            Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER} `
          }
        }
      )
      .then(resp => {
        console.log(resp.data);
        if (resp.status === 200) {
          if (resp.data.message.includes("Smart card resolved successfully")) {
            resolve(true);
          } else {
            resolve(false);
          }
        } else {
          resolve(false);
        }
      })
      .catch(error => {
        console.log(error);
        resolve(false);
      });
  });
}

async function fetchCableProviders() {
  return new Promise(async resolve => {
    let cachedProviders = await redisClient.existsAsync(
      `${APP_PREFIX_REDIS}:CableTVProviders`
    );

    if (cachedProviders === 0) {
      console.log("Fetching list of cable providers");
      let callResponse = await axios.get(
        `${FelaMarketPlace.BASE_URL}/list/cableProviders`,
        {
          headers: felaHeader
        }
      );

      let providers = callResponse.data.data;

      for (let value of Object.values(providers)) {
        await redisClient.zaddAsync(
          `${APP_PREFIX_REDIS}:CableTVProviders`,
          value.code,
          `${value.title}`
        );
      }
      redisClient.expire(
        `${APP_PREFIX_REDIS}:CableTVProviders`,
        API_DATA_EXPIRE_TIME
      );
    }

    let response = await redisClient.zrangeAsync(
      `${APP_PREFIX_REDIS}:CableTVProviders`,
      0,
      -1
    );
    resolve(response);
  });
}

async function fetchBouquets(providerCode, providerName, start, end) {
  return new Promise(async resolve => {
    let cachedBouquets = await redisClient.existsAsync(
      `${APP_PREFIX_REDIS}:CableTVBouquet:${providerCode}:Name`
    );

    if (cachedBouquets === 0) {
      console.log(`Fetching bouquets for ${providerName}`);
      let callResponse = await axios.get(
        `${FelaMarketPlace.BASE_URL}/list/cableBouquets?provider_code=${providerCode}`,
        {
          headers: felaHeader
        }
      );

      let providers = callResponse.data.data;

      for (let value of Object.values(providers)) {
        let bouquetName = "";

        switch (providerName) {
          case "DSTV":
            bouquetName = refineDSTVBouquetName(value.title);
            break;
          case "GOTV":
            bouquetName = refineGOTVBouquetName(value.title);
            break;
          default:
            bouquetName = value.title;
        }

        await redisClient.zaddAsync(
          `${APP_PREFIX_REDIS}:CableTVBouquet:${providerCode}:Name`,
          value.price,
          bouquetName
        );
        await redisClient.zaddAsync(
          `${APP_PREFIX_REDIS}:CableTVBouquet:${providerCode}:Code`,
          value.price,
          `${value.code}`
        );
      }
      redisClient.expire(
        `${APP_PREFIX_REDIS}:CableTVBouquet:${providerCode}:Name`,
        API_DATA_EXPIRE_TIME
      );
      redisClient.expire(
        `${APP_PREFIX_REDIS}:CableTVBouquet:${providerCode}:Code`,
        API_DATA_EXPIRE_TIME
      );
    }

    let response = await redisClient.zrevrangeAsync(
      `${APP_PREFIX_REDIS}:CableTVBouquet:${providerCode}:Name`,
      start,
      end
    );

    console.log(response);
    resolve(response);
  });
}

function refineDSTVBouquetName(name) {
  let refinedName = "";
  if (name.includes("HDPVR/Extraview")) {
    name = name.replace(/\s/g, "");
    name = name.replace("and", "&");
    refinedName = name.replace("Extraview", "Xtraview");
  } else if (name === "HDPVR Access_Extraview") {
    name = name.replace(/\s/g, "");
    name = name.replace("_", "");
    refinedName = name.replace("Extraview", "Xtraview");
  } else {
    refinedName = name.replace(/\s/g, "");
  }

  return refinedName;
}

function refineGOTVBouquetName(name) {
  let refinedName = "";
  if (name.includes("Gotv")) {
    console.log("In Here");
    name = name.replace(/\s/g, "");
    refinedName = name.replace("Gotv", "");
  } else if (name.includes("GOtv")) {
    name = name.replace(/\s/g, "");
    refinedName = name.replace("GOtv", "");
  } else {
    refinedName = name;
  }

  return refinedName;
}

async function displayCableProviders() {
  return new Promise(async resolve => {
    let providers = await fetchCableProviders();

    let response = "CON Select Cable Provider:\n";
    providers.forEach((value, index) => {
      response += `${++index} ${value}\n`;
    });

    resolve(response);
  });
}

async function displayBouquets(providerCode, providerName, start, end) {
  return new Promise(async resolve => {
    let bouquets = await fetchBouquets(providerCode, providerName, start, end);

    let response = `CON Select your Bouquet:\n`;
    let index = 0;
    bouquets.forEach(value => {
      response += `${++index} ${value}\n`;
    });

    let rank = await redisClient.zrankAsync(
      `${APP_PREFIX_REDIS}:CableTVBouquet:${providerCode}:Name`,
      `${bouquets[bouquets.length - 1]}`
    );

    if (rank !== 0) {
      response += `${++index} Next`;
    }

    console.log(rank);

    resolve(response);
  });
}

function processCableTVPayment(
  sessionId,
  phoneNumber,
  cardNo,
  providerCode,
  bouquetCode,
  paymentMethod,
  walletPin = "",
  chosenUSSDBankCode = ""
) {
  return new Promise(async (resolve, reject) => {
    let payload = {
      offeringGroup: "core",
      offeringName: "cabletv",
      method: `${paymentMethod}`,
      auth: {
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        passkey: `${walletPin}`
      },
      params: {
        smartcard_number: `${cardNo}`,
        provider_code: `${providerCode}`,
        service_code: `${bouquetCode}`
      },
      user: {
        sessionId: `${sessionId}`,
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        sourceId: `${phoneNumber}`,
        phoneNumber: `${phoneNumber}`
      }
    };

    try {
      let response = await axios.post(
        `${FelaMarketPlace.BASE_URL}/payment/request`,
        payload,
        {
          headers: felaHeader
        }
      );
      if (paymentMethod === "felawallet") {
        console.log("Success!");
        console.log(response.data);
        await redisClient.incrAsync(
          `${APP_PREFIX_REDIS}:reports:count:purchases_CableTVWithWallet:${moment().format(
            "DMMYYYY"
          )}`
        );
        resolve(`CON Dear Customer, your payment was successful!\n\n0 Menu`);
      } else {
        console.log("Getting response from coral pay");
        await redisClient.incrAsync(
          `${APP_PREFIX_REDIS}:reports:count:purchases_CableTVWithMyBankUSSD:${moment().format(
            "DMMYYYY"
          )}`
        );
        let paymentToken = response.data.data.paymentToken;
        // console.log(response.data);

        resolve(
          `CON Ur Bank is *${chosenUSSDBankCode}#\nNever 4GET *000*\nTrans Code is ${paymentToken}\nRem last 4 Digits!\n\nDial2Pay *${chosenUSSDBankCode}*000*${paymentToken}#\nExpires in 5mins\n\nCashback\nWin N5k-100m\n\n0 Menu`
        );
        // resolve(
        //   `CON To complete your transaction, dial *${chosenUSSDBankCode}*000*${paymentToken}#\nPlease note that this USSD String will expire in the next 5 minutes.\n\n 0 Menu`
        // );
      }
    } catch (error) {
      console.log("error");
      console.log(JSON.stringify(error.response.data, null, 2));
      if (!!error.response) {
        resolve(
          `CON Transaction Failed!\n${error.response.data.message}\n\nEnter 0 Back to home menu`
        );
      } else {
        resolve(`CON Transaction Failed!\n\nEnter 0 Back to home menu`);
      }
    }
  });
}

function displayMyBankUSSDBanks() {
  let response = "CON Select your Bank:\n";
  let bankNames = Object.keys(MYBANKUSSD_BANK_CODES);

  for (let [index, bank] of bankNames.entries()) {
    response += `${++index} ${bank}\n`;
  }
  return response;
}

module.exports = {
  processCableTv
};
