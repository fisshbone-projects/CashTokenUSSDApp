const { redisClient } = require("$config/redisConnectConfig");
const { FelaMarketPlace, App } = require("$config");
const {
  APP_PREFIX_REDIS,
  formatNumber,
  MYBANKUSSD_BANK_CODES,
  expireReportsInRedis,
} = require("$utils");
const moment = require("moment");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
const API_DATA_EXPIRE_TIME = parseInt(App.REDIS_API_DATA_EXPIRE);

async function regularBuy(phoneNumber, text, sessionId) {
  let { cableProviderName, cableProviderCode } = await redisClient.hgetallAsync(
    `${APP_PREFIX_REDIS}:${sessionId}`
  );

  return new Promise(async (resolve, reject) => {
    console.log("Starting the CableTV bill payment process");
    let brokenDownText = text.split("*");

    let response = await menuFlowDisplayProviders(brokenDownText, sessionId);
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
                    response = `CON Error!\nInvalid response entered\n\nEnter 0 Back to home menu`;
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

async function menuFlowDisplayProviders(brokenDownText, sessionId) {
  return new Promise(async (resolve) => {
    let response = "";
    let textLength = brokenDownText.length;
    if (textLength === 3) {
      await redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "cabletv_purchase_method",
        "regularBuy"
      );
      response = await displayCableProviders();
    } else {
      response = "";
    }
    resolve(response);
  });
}

async function menuFlowDisplayBouquets(brokenDownText, sessionId) {
  return new Promise(async (resolve) => {
    let response = "";
    let textLength = brokenDownText.length;

    if (textLength === 4) {
      let selectedProvider = Number(brokenDownText[textLength - 1]);
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
            response = await displayBouquets(providerCode, providerName, 0, 2);
            await redisClient.hset(
              `${APP_PREFIX_REDIS}:${sessionId}`,
              "ussdState",
              "getSmartCardNumber"
            );
            break;
          case "GOTV":
            response = await displayBouquets(providerCode, providerName, 0, -1);
            await redisClient.hset(
              `${APP_PREFIX_REDIS}:${sessionId}`,
              "ussdState",
              "getSmartCardNumber"
            );
            break;
          default:
            response = `CON Bouquet not available at the moment for this provider.\nPlease check again soon.\n\n 0 Menu`;
        }
      } else {
        response =
          "CON Error!\nSelect a valid cable provider\n\nEnter 0 Back to home menu";
      }
    } else {
      response = "";
    }
    resolve(response);
  });
}

async function menuFlowDisplayOverFlowBouquets(
  brokenDownText,
  sessionId,
  providerCode,
  providerName
) {
  return new Promise(async (resolve) => {
    let response = "";
    let textLength = brokenDownText.length;

    switch (providerName) {
      case "DSTV":
        if ([5, 6, 7, 8, 9, 10].includes(textLength)) {
          let userResponse = brokenDownText[textLength - 1];
          let showNext = false;
          let displayStart = 0;
          let displayEnd = 0;

          switch (textLength) {
            case 5:
              console.log("HEREHERE");
              showNext = userResponse === "4";
              displayStart = 3;
              displayEnd = 6;
              break;
            case 6:
              showNext = userResponse === "5";
              displayStart = 7;
              displayEnd = 11;
              break;
            case 7:
              showNext = userResponse === "6";
              displayStart = 12;
              displayEnd = 15;
              break;
            case 8:
              showNext = userResponse === "5";
              displayStart = 16;
              displayEnd = 19;
              break;
            case 9:
              showNext = userResponse === "5";
              displayStart = 20;
              displayEnd = 25;
              break;
            case 10:
              showNext = userResponse === "7";
              displayStart = 26;
              displayEnd = -1;
              break;
          }

          if (showNext) {
            response = await displayBouquets(
              providerCode,
              providerName,
              displayStart,
              displayEnd
            );
            await redisClient.hset(
              `${APP_PREFIX_REDIS}:${sessionId}`,
              "ussdState",
              "getSmartCardNumber"
            );
          } else {
            response = "";
          }
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
  return new Promise(async (resolve) => {
    let response = "";
    let textLength = brokenDownText.length;
    let currentState = await redisClient.hgetAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`,
      "ussdState"
    );

    console.log("CableTV State", currentState);

    switch (providerName) {
      case "DSTV":
        let bouquetSelection = Number(brokenDownText[textLength - 1]);
        if (
          textLength === 5 &&
          Number(brokenDownText[textLength - 1]) <= 3 &&
          currentState === "getSmartCardNumber"
        ) {
          let selectedBouquet = parseInt(brokenDownText[textLength - 1]);
          saveSelectedBouquet(providerCode, selectedBouquet - 1, sessionId);
          await redisClient.hset(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "ussdState",
            "getPaymentMethod"
          );

          response = `CON Enter your SmartCard Number:`;
        } else if (
          ((textLength === 6 && bouquetSelection <= 4) ||
            (textLength === 7 && bouquetSelection <= 5) ||
            (textLength === 8 && bouquetSelection <= 4) ||
            (textLength === 9 && bouquetSelection <= 4) ||
            (textLength === 10 && bouquetSelection <= 6) ||
            (textLength === 11 && bouquetSelection <= 7)) &&
          currentState === "getSmartCardNumber"
        ) {
          let addBy = 0;
          switch (textLength) {
            case 6:
              addBy = 2;
              break;
            case 7:
              addBy = 6;
              break;
            case 8:
              addBy = 11;
              break;
            case 9:
              addBy = 15;
              break;
            case 10:
              addBy = 19;
              break;
            case 11:
              addBy = 25;
              break;
          }
          saveSelectedBouquet(
            providerCode,
            bouquetSelection + addBy,
            sessionId
          );
          await redisClient.hset(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "ussdState",
            "getPaymentMethod"
          );
          response = `CON Enter your SmartCard Number:`;
        }
        break;
      case "GOTV":
        if (
          textLength === 5 &&
          Number(brokenDownText[textLength - 1]) <= 6 &&
          currentState === "getSmartCardNumber"
        ) {
          let selectedBouquet = parseInt(brokenDownText[textLength - 1]);
          saveSelectedBouquet(providerCode, selectedBouquet - 1, sessionId);
          await redisClient.hset(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "ussdState",
            "getPaymentMethod"
          );
          response = `CON Enter your SmartCard Number:`;
        }
        break;
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
  return new Promise(async (resolve) => {
    let response = "";
    let textLength = brokenDownText.length;
    let currentState = await redisClient.hgetAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`,
      "ussdState"
    );

    switch (providerName) {
      case "DSTV":
        if (
          [6, 7, 8, 9, 10, 11, 12].includes(textLength) &&
          brokenDownText[textLength - 1].length > 5 &&
          currentState === "getPaymentMethod"
        ) {
          let {
            cableBouquetCode: bouquetCode,
          } = await redisClient.hgetallAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`
          );

          let smartCardNo = brokenDownText[textLength - 1];
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
          } else {
            response = `CON Error!\nInputed smartcard number cannot be verified \n\nEnter 0 Back to home menu`;
          }
        }
        break;
      case "GOTV":
        if (textLength === 6 && currentState === "getPaymentMethod") {
          let {
            cableBouquetCode: bouquetCode,
          } = await redisClient.hgetallAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`
          );

          let smartCardNo = brokenDownText[textLength - 1];
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
          } else {
            response = `CON Error!\nInputed smartcard number cannot be verified \n\nEnter 0 Back to home menu`;
          }
        }
        break;
    }

    resolve(response);
  });
}

async function menuFlowGetPaymentDetails(
  brokenDownText,
  sessionId,
  providerName
) {
  return new Promise(async (resolve) => {
    let response = "";
    let textLength = brokenDownText.length;
    let currentState = await redisClient.hgetAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`,
      "ussdState"
    );

    switch (providerName) {
      case "DSTV":
        if (
          [7, 8, 9, 10, 11, 12, 13].includes(textLength) &&
          currentState === "getPaymentDetails"
        ) {
          let paymentMethod = brokenDownText[textLength - 1];

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
            } else {
              await redisClient.hmsetAsync(
                `${APP_PREFIX_REDIS}:${sessionId}`,
                "paymentMethod",
                "coralpay",
                "ussdState",
                "displaySummary"
              );
              response = displayMyBankUSSDBanks();
            }
          } else {
            response =
              "CON Error!\nSelect a valid payment method\n\nEnter 0 Back to home menu";
          }
        }
        break;

      case "GOTV":
        if (textLength === 7 && currentState === "getPaymentDetails") {
          let paymentMethod = brokenDownText[textLength - 1];

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
            } else {
              await redisClient.hmsetAsync(
                `${APP_PREFIX_REDIS}:${sessionId}`,
                "paymentMethod",
                "coralpay",
                "ussdState",
                "displaySummary"
              );
              response = displayMyBankUSSDBanks();
            }
          } else {
            response =
              "CON Error!\nSelect a valid payment method\n\nEnter 0 Back to home menu";
          }
        }
        break;
    }

    resolve(response);
  });
}

async function menuFlowDisplaySummary(brokenDownText, sessionId, providerName) {
  return new Promise(async (resolve) => {
    let response = "";
    let textLength = brokenDownText.length;
    let {
      ussdState: currentState,
      paymentMethod,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

    switch (providerName) {
      case "DSTV":
        if (
          [8, 9, 10, 11, 12, 13, 14].includes(textLength) &&
          currentState === "displaySummary" &&
          paymentMethod === "felawallet"
        ) {
          let walletPin = brokenDownText[textLength - 1];
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
              bouquetPrice,
            } = await redisClient.hgetallAsync(
              `${APP_PREFIX_REDIS}:${sessionId}`
            );
            response = `CON Confirm:\nProvider: ${cableProviderName}\nBouquet: ${cableBouquetName}\nCardNo: ${cableCardNo}\nPrice: ${formatNumber(
              bouquetPrice
            )}\nPay: Wallet\n\n1 Confirm\n2 Cancel`;
          } else {
            console.log("PIN is invalid");
            response = `CON Error!\nPIN can only be numbers\n\nEnter 0 Back to home menu`;
          }
        } else if (
          [8, 9, 10, 11, 12, 13, 14].includes(textLength) &&
          currentState === "displaySummary" &&
          paymentMethod === "coralpay"
        ) {
          let {
            cableProviderName,
            cableBouquetName,
            cableCardNo,
            bouquetPrice,
          } = await redisClient.hgetallAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`
          );

          let chosenUSSDBank = Number(brokenDownText[textLength - 1]);

          if (chosenUSSDBank <= Object.values(MYBANKUSSD_BANK_CODES).length) {
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

            response = `CON Confirm:\nProvider: ${cableProviderName}\nBouquet: ${cableBouquetName}\nCardNo: ${cableCardNo}\nPrice: ${formatNumber(
              bouquetPrice
            )}\nPay: ${
              chosenUSSDBankName.includes("bank") ||
              chosenUSSDBankName == "GTB" ||
              chosenUSSDBankName == "FBN" ||
              chosenUSSDBankName == "UBA"
                ? chosenUSSDBankName
                : `${chosenUSSDBankName}`
            }\n\n1 Confirm\n2 Cancel`;
          } else {
            console.log("Invalid myBankUSSD bank inputted");
            response = `CON Error!\nSelect a valid bank\n\nEnter 0 Back to home menu`;
          }
        }
        break;

      case "GOTV":
        if (
          textLength === 8 &&
          currentState === "displaySummary" &&
          paymentMethod === "felawallet"
        ) {
          let walletPin = brokenDownText[textLength - 1];
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
              bouquetPrice,
            } = await redisClient.hgetallAsync(
              `${APP_PREFIX_REDIS}:${sessionId}`
            );
            response = `CON Confirm CableTV Payment:\nProvider: ${cableProviderName}\nBouquet: ${cableBouquetName}\nCardNo: ${cableCardNo}\nPrice: ${formatNumber(
              bouquetPrice
            )}\nPayMethod: Wallet\n\n1 Confirm\n2 Cancel`;
          } else {
            console.log("PIN is invalid");
            response = `CON Error!\nPIN can only be numbers\n\nEnter 0 Back to home menu`;
          }
        } else if (
          textLength === 8 &&
          currentState === "displaySummary" &&
          paymentMethod === "coralpay"
        ) {
          let {
            cableProviderName,
            cableBouquetName,
            cableCardNo,
            bouquetPrice,
          } = await redisClient.hgetallAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`
          );

          let chosenUSSDBank = parseInt(brokenDownText[textLength - 1], 10);

          if (chosenUSSDBank <= Object.values(MYBANKUSSD_BANK_CODES).length) {
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
          } else {
            console.log("Invalid myBankUSSD bank inputted");
            response = `CON Error!\nSelect a valid bank\n\nEnter 0 Back to home menu`;
          }
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
  return new Promise(async (resolve) => {
    let response = "";
    let textLength = brokenDownText.length;
    let {
      ussdState: currentState,
      paymentMethod,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

    switch (providerName) {
      case "DSTV":
        if (
          [9, 10, 11, 12, 13, 14, 15].includes(textLength) &&
          currentState === "makePayment" &&
          paymentMethod === "felawallet"
        ) {
          let userResponse = brokenDownText[textLength - 1];

          if (userResponse === "1") {
            let {
              cableProviderCode,
              cableCardNo,
              cableBouquetCode,
              paymentMethod,
              walletPin,
              bouquetPrice,
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
              bouquetPrice,
              walletPin
            );
          } else {
            response = `CON Transaction canceled by user.\n\n0 Menu`;
          }
        } else if (
          [9, 10, 11, 12, 13, 14, 15].includes(textLength) &&
          currentState === "makePayment" &&
          paymentMethod === "coralpay"
        ) {
          let userResponse = brokenDownText[textLength - 1];
          if (userResponse === "1") {
            let {
              cableProviderCode,
              cableCardNo,
              cableBouquetCode,
              paymentMethod,
              chosenUSSDBankCode,
              bouquetPrice,
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
              bouquetPrice,
              undefined,
              chosenUSSDBankCode
            );
          } else {
            response = `CON Transaction canceled by user.\n\n0 Menu`;
          }
        }

        break;
      case "GOTV":
        if (
          textLength === 9 &&
          brokenDownText[textLength - 1] === "1" &&
          currentState === "makePayment" &&
          paymentMethod === "felawallet"
        ) {
          let {
            cableProviderCode,
            cableCardNo,
            cableBouquetCode,
            paymentMethod,
            walletPin,
            bouquetPrice,
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
            bouquetPrice,
            walletPin
          );
        } else if (
          textLength === 9 &&
          brokenDownText[textLength - 1] === "1" &&
          currentState === "makePayment" &&
          paymentMethod === "coralpay"
        ) {
          let {
            cableProviderCode,
            cableCardNo,
            cableBouquetCode,
            paymentMethod,
            chosenUSSDBankCode,
            bouquetPrice,
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
            bouquetPrice,
            undefined,
            chosenUSSDBankCode
          );
        } else if (
          textLength === 9 &&
          brokenDownText[textLength - 1] === "2" &&
          currentState === "makePayment" &&
          (paymentMethod === "felawallet" || paymentMethod === "coralpay")
        ) {
          response = `CON Transaction canceled by user.\n\n0 Menu`;
        }

        break;
    }

    resolve(response);
  });
}

async function saveSelectedBouquet(providerCode, selectedBouquet, sessionId) {
  return new Promise(async (resolve) => {
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
  return new Promise((resolve) => {
    console.log(smartCardNo, providerCode, bouquetCode);
    axios
      .get(
        `${FelaMarketPlace.BASE_URL}/info/tvSmartCard?number=${smartCardNo}&provider_code=${providerCode}&service_code=${bouquetCode}
        `,
        {
          headers: {
            Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER} `,
          },
        }
      )
      .then((resp) => {
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
      .catch((error) => {
        console.log(error);
        resolve(false);
      });
  });
}

async function fetchCableProviders() {
  return new Promise(async (resolve) => {
    let cachedProviders = await redisClient.existsAsync(
      `${APP_PREFIX_REDIS}:CableTVProviders`
    );

    if (cachedProviders === 0) {
      console.log("Fetching list of cable providers");
      let callResponse = await axios.get(
        `${FelaMarketPlace.BASE_URL}/list/cableProviders`,
        {
          headers: felaHeader,
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
  return new Promise(async (resolve) => {
    let cachedBouquets = await redisClient.existsAsync(
      `${APP_PREFIX_REDIS}:CableTVBouquet:${providerCode}:Name`
    );

    if (cachedBouquets === 0) {
      console.log(`Fetching bouquets for ${providerName}`);
      let callResponse = await axios.get(
        `${FelaMarketPlace.BASE_URL}/list/cableBouquets?provider_code=${providerCode}`,
        {
          headers: felaHeader,
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
  return new Promise(async (resolve) => {
    let providers = await fetchCableProviders();

    let response = "CON Select Cable Provider:\n";
    providers.forEach((value, index) => {
      response += `${++index} ${value}\n`;
    });

    resolve(response);
  });
}

async function displayBouquets(providerCode, providerName, start, end) {
  return new Promise(async (resolve) => {
    let bouquets = await fetchBouquets(providerCode, providerName, start, end);

    let response = `CON Select your Bouquet:\n`;
    let index = 0;
    bouquets.forEach((value) => {
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
  price,
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
        passkey: `${walletPin}`,
      },
      params: {
        smartcard_number: `${cardNo}`,
        provider_code: `${providerCode}`,
        service_code: `${bouquetCode}`,
      },
      user: {
        sessionId: `${sessionId}`,
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        sourceId: `${phoneNumber}`,
        phoneNumber: `${phoneNumber}`,
      },
    };

    try {
      let response = await axios.post(
        `${FelaMarketPlace.BASE_URL}/payment/request`,
        payload,
        {
          headers: felaHeader,
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
        // expireReportsInRedis(
        //   `${APP_PREFIX_REDIS}:reports:count:purchases_CableTVWithWallet:${moment().format(
        //     "DMMYYYY"
        //   )}`
        // );
        await redisClient.incrbyAsync(
          `${APP_PREFIX_REDIS}:reports:count:totalValue_CableTVWithWallet:${moment().format(
            "DMMYYYY"
          )}`,
          parseInt(price)
        );
        // expireReportsInRedis(
        //   `${APP_PREFIX_REDIS}:reports:count:totalValue_CableTVWithWallet:${moment().format(
        //     "DMMYYYY"
        //   )}`
        // );
        resolve(`END Dear Customer, your payment was successful!`);
      } else {
        console.log("Getting response from coral pay");
        await redisClient.incrAsync(
          `${APP_PREFIX_REDIS}:reports:count:purchases_CableTVWithMyBankUSSD:${moment().format(
            "DMMYYYY"
          )}`
        );
        // expireReportsInRedis(
        //   `${APP_PREFIX_REDIS}:reports:count:purchases_CableTVWithMyBankUSSD:${moment().format(
        //     "DMMYYYY"
        //   )}`
        // );
        await redisClient.incrbyAsync(
          `${APP_PREFIX_REDIS}:reports:count:totalValue_CableTVWithMyBankUSSD:${moment().format(
            "DMMYYYY"
          )}`,
          parseInt(price)
        );
        // expireReportsInRedis(
        //   `${APP_PREFIX_REDIS}:reports:count:totalValue_CableTVWithMyBankUSSD:${moment().format(
        //     "DMMYYYY"
        //   )}`
        // );
        let paymentToken = response.data.data.paymentToken;
        // console.log(response.data);

        // resolve(
        //   `CON Ur Bank is *${chosenUSSDBankCode}#\nNever 4GET *000*\nTrans Code is ${paymentToken}\nRem last 4 Digits!\n\nDial2Pay *${chosenUSSDBankCode}*000*${paymentToken}#\nExpires in 5mins\n\nCashback\nWin N5k-100m\n\n0 Menu`
        // );
        // resolve(
        //   `CON To complete your transaction, dial *${chosenUSSDBankCode}*000*${paymentToken}#\nPlease note that this USSD String will expire in the next 5 minutes.\n\n 0 Menu`
        // );
        resolve(
          `END *${chosenUSSDBankCode}*000*${paymentToken}#\nDear Customer, memorize and dial the above code in your phone dialer to complete your transaction via your bank.`
        );
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
  regularBuy,
};
