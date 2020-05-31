const { redisClient } = require("$config/redisConnectConfig");
const { FelaMarketPlace, App } = require("$config/index");
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

async function processElectricity(phoneNumber, text, sessionId) {
  return new Promise(async (resolve, reject) => {
    console.log("Starting the Electricity bill payment process");
    let response = "";
    let brokenDownText = text.split("*");
    if (brokenDownText.length === 2) {
      await redisClient.incrAsync(
        `${APP_PREFIX_REDIS}:reports:count:subMenu_PurchaseElectricity:${moment().format(
          "DMMYYYY"
        )}`
      );
      // expireReportsInRedis(
      //   `${APP_PREFIX_REDIS}:reports:count:subMenu_PurchaseElectricity:${moment().format(
      //     "DMMYYYY"
      //   )}`
      // );
      response = `CON Choose your electricity plan:\n1 Prepaid\n2 Postpaid`;
      resolve(response);
      //Return list of services.. Prepaid or Postpaid
    } else if (brokenDownText.length === 3) {
      let electricPlan = brokenDownText[2];
      if (electricPlan === "1" || electricPlan === "2") {
        if (electricPlan === "1") {
          await redisClient.hsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "electricPlan",
            "prepaid"
          );
          response = await displayListOfDiscos("prepaid");
          resolve(response);
        } else {
          await redisClient.hsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "electricPlan",
            "postpaid"
          );
          response = await displayListOfDiscos("postpaid");
          resolve(response);
        }
      } else {
        response =
          "CON Error!\nSelect a valid electricity plan\n\nEnter 0 Back to home menu";
        resolve(response);
      }

      //Return list of discos under that service chosen
    } else if (brokenDownText.length === 4) {
      let { electricPlan } = await redisClient.hgetallAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`
      );
      let selectedDisco = brokenDownText[3];
      if (electricPlan === "prepaid") {
        if (parseInt(selectedDisco) <= 9 && parseInt(selectedDisco) >= 1) {
          await saveDisco(electricPlan, selectedDisco, sessionId);
          response = `CON Enter your meter number:`;
          resolve(response);
        } else {
          response =
            "CON Error!\nSelect a valid disco\n\nEnter 0 Back to home menu";
          resolve(response);
        }
      } else if (electricPlan === "postpaid") {
        if (parseInt(selectedDisco) <= 9 && parseInt(selectedDisco) >= 1) {
          await saveDisco(electricPlan, selectedDisco, sessionId);
          response = `CON Enter your meter number:`;
          resolve(response);
        } else {
          response =
            "CON Error!\nSelect a valid disco\n\nEnter 0 Back to home menu";
          resolve(response);
        }
      }

      //Enter meter number
    } else if (brokenDownText.length === 5) {
      let meterNumber = brokenDownText[4];
      let { electricPlan, discoCode } = await redisClient.hgetallAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`
      );

      let checkMeterNo = await confirmMeterNo(
        meterNumber,
        electricPlan,
        discoCode,
        sessionId
      );
      if (checkMeterNo) {
        console.log("Meter No. is valid");
        await redisClient.hsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "meterNumber",
          meterNumber
        );
        response = `CON Enter amount:`;
        resolve(response);
      } else {
        response = `CON Error!\nInputed meter number cannot be verified \n\nEnter 0 Back to home menu`;
        resolve(response);
      }

      //Enter meter number
    } else if (brokenDownText.length === 6) {
      let amount = brokenDownText[5];
      let minimumAmount = await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "electrityMinAmount"
      );

      if (/^[0-9]*$/.test(amount)) {
        if (parseInt(amount) >= parseInt(minimumAmount)) {
          await redisClient.hsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "amount",
            `${amount}`
          );

          response = `CON Select payment method:\n1 My Wallet\n2 MyBankUSSD`;
          resolve(response);
        } else {
          console.log(
            "Amount inputted is less than the discos minimum amount that can be bought"
          );
          response = `CON Error!\nAmount inputted (N${parseInt(
            amount
          )}) is less than the minimum amount you can pay (N${parseInt(
            minimumAmount
          )})\n\n0 Menu`;
          resolve(response);
        }
      } else {
        console.log("Amount inputed is invalid");
        response = `CON Error!\nAmount can only be numbers\n\nEnter 0 Back to home menu`;
        resolve(response);
      }
    } else if (brokenDownText.length === 7) {
      let paymentMethod = brokenDownText[6];

      if (paymentMethod === "1" || paymentMethod === "2") {
        if (paymentMethod === "1") {
          await redisClient.hsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "paymentMethod",
            "felawallet"
          );
          response = "CON Enter your wallet PIN:";
          resolve(response);
        } else {
          await redisClient.hsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "paymentMethod",
            "coralpay"
          );
          response = displayMyBankUSSDBanks();
          resolve(response);
        }
      } else {
        response =
          "CON Error!\nSelect a valid payment method\n\nEnter 0 Back to home menu";
        resolve(response);
      }

      //Choose Payment Method
    } else if (
      brokenDownText.length === 8 &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      )) === "felawallet"
    ) {
      let walletPin = brokenDownText[7];
      if (/^[0-9]*$/.test(walletPin)) {
        await redisClient.hsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "walletPin",
          `${walletPin}`
        );
        let {
          electricPlan,
          discoCode,
          meterNumber,
          amount,
        } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

        response = `CON Confirm Electricity Bill Payment:\nMeterNo: ${meterNumber}\nElectric Plan: ${
          electricPlan[0].toUpperCase() + electricPlan.substr(1)
        }\nDisco: ${discoCode}\nAmount: ${formatNumber(
          amount
        )}\nPayMethod: Wallet\n\n1 Confirm\n2 Cancel`;
        resolve(response);
      } else {
        console.log("PIN is invalid");
        response = `CON Error!\nPIN can only be numbers\n\nEnter 0 Back to home menu`;
        resolve(response);
      }
      //Payment is wallet
    } else if (
      brokenDownText.length === 8 &&
      parseInt(brokenDownText[7], 10) <=
        Object.values(MYBANKUSSD_BANK_CODES).length &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      )) === "coralpay"
    ) {
      let {
        electricPlan,
        discoCode,
        meterNumber,
        amount,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

      let chosenUSSDBank = parseInt(brokenDownText[7], 10);
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
        chosenUSSDBankCode
      );

      response = `CON Confirm Electricity Bill Payment:\nMeterNo: ${meterNumber}\nElectric Plan: ${
        electricPlan[0].toUpperCase() + electricPlan.substr(1)
      }\nDisco: ${discoCode}\nAmount: ${formatNumber(amount)}\nPayMethod: ${
        chosenUSSDBankName.includes("bank") ||
        chosenUSSDBankName == "GTB" ||
        chosenUSSDBankName == "FBN" ||
        chosenUSSDBankName == "UBA"
          ? chosenUSSDBankName
          : `${chosenUSSDBankName}`
      }\n\n1 Confirm\n2 Cancel`;
      resolve(response);
      //payment is with coralpay
    } else if (
      brokenDownText.length === 9 &&
      brokenDownText[8] === "1" &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      )) === "felawallet"
    ) {
      let {
        electricPlan,
        discoCode,
        amount,
        meterNumber,
        paymentMethod,
        walletPin,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      response = await processElectricityPayment(
        sessionId,
        phoneNumber,
        meterNumber,
        discoCode,
        electricPlan,
        amount,
        paymentMethod,
        walletPin
      );
      resolve(response);
    } else if (
      brokenDownText.length === 9 &&
      brokenDownText[8] === "2" &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      )) === "felawallet"
    ) {
      response = `CON Transaction canceled by user.\n\n0 Menu`;
      resolve(response);
    } else if (
      brokenDownText.length === 9 &&
      brokenDownText[8] === "1" &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      )) === "coralpay"
    ) {
      let {
        electricPlan,
        discoCode,
        amount,
        meterNumber,
        paymentMethod,
        chosenUSSDBankCode,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      response = await processElectricityPayment(
        sessionId,
        phoneNumber,
        meterNumber,
        discoCode,
        electricPlan,
        amount,
        paymentMethod,
        undefined,
        chosenUSSDBankCode
      );
      resolve(response);
    } else if (
      brokenDownText.length === 9 &&
      brokenDownText[8] === "2" &&
      (await redisClient.hgetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "paymentMethod"
      )) === "coralpay"
    ) {
      response = `CON Transaction canceled by user.\n\n0 Menu`;
      resolve(response);
    } else {
      response = `CON Error!\nInvalid response entered\n\nEnter 0 Back to home menu`;
      resolve(response);
    }
  });
}

async function confirmMeterNo(meterNumber, electricPlan, discoCode, sessionId) {
  return new Promise((resolve) => {
    console.log(electricPlan, discoCode, meterNumber);
    axios
      .get(
        `${FelaMarketPlace.BASE_URL}/info/meterNo?number=${meterNumber}&provider_code=${discoCode}&service_code=${electricPlan}`,
        {
          headers: {
            Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER} `,
          },
        }
      )
      .then(async (resp) => {
        console.log(resp.data);
        if (resp.status === 200) {
          if (
            resp.data.message.includes("Meter number resolved successfully")
          ) {
            let minimumAmount = parseInt(resp.data.data.customer.minimumAmount);
            await redisClient.hsetAsync(
              `${APP_PREFIX_REDIS}:${sessionId}`,
              "electrityMinAmount",
              `${minimumAmount}`
            );

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

async function saveDisco(electricPlan, selectedDisco, sessionId) {
  return new Promise(async (resolve) => {
    if (electricPlan === "prepaid") {
      let [planCode] = await redisClient.zrangebyscoreAsync(
        `${APP_PREFIX_REDIS}:Discos:Prepaid:Code`,
        selectedDisco,
        selectedDisco
      );
      await redisClient.hsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "discoCode",
        planCode
      );
      console.log(planCode);
      resolve();
    } else {
      // if (selectedDisco === "4") {
      //   selectedDisco = "5";
      // } else if (selectedDisco === "5") {
      //   selectedDisco = "7";
      // }
      let [planCode] = await redisClient.zrangebyscoreAsync(
        `${APP_PREFIX_REDIS}:Discos:Postpaid:Code`,
        selectedDisco,
        selectedDisco
      );
      await redisClient.hsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "discoCode",
        planCode
      );
      console.log(planCode);
      resolve();
    }
  });
}

async function displayListOfDiscos(plan) {
  return new Promise(async (resolve) => {
    let response = "CON Select Disco:\n";
    if (plan === "prepaid") {
      response += await displayDisco("Prepaid");
      resolve(response);
    } else {
      response += await displayDisco("Postpaid");
      resolve(response);
    }

    function displayDisco(planType) {
      return new Promise(async (resolve) => {
        let response = "";
        let index = 1;
        let infoExists = await redisClient.existsAsync(
          `${APP_PREFIX_REDIS}:Discos:${planType}:Title`
        );

        if (infoExists === 0) {
          await fetchDiscoDetails();
        }

        let listOfDiscos = await redisClient.zrangeAsync(
          `${APP_PREFIX_REDIS}:Discos:${planType}:Title`,
          0,
          -1
        );

        for (let disco of listOfDiscos) {
          response += `${index++} ${refineDiscoName(disco)}\n`;
        }
        resolve(response);
      });
    }

    function refineDiscoName(disco) {
      let refine1 = disco.replace(/ /g, "");
      let refine2 = refine1.replace("Electricity", "");
      let refine3 = refine2.replace(")", "");
      let refine4 = refine3.replace("(", ":");

      return refine4;
    }
  });
}

function processElectricityPayment(
  sessionId,
  phoneNumber,
  meterNumber,
  providerCode,
  serviceCode,
  amount,
  paymentMethod,
  walletPin = "",
  chosenUSSDBankCode = ""
) {
  return new Promise(async (resolve, reject) => {
    let payload = {
      offeringGroup: "core",
      offeringName: "electricity",
      method: `${paymentMethod}`,
      auth: {
        source: `${FelaMarketPlace.THIS_SOURCE}`,
        passkey: `${walletPin}`,
      },
      params: {
        meter_number: `${meterNumber}`,
        provider_code: `${providerCode}`,
        service_code: `${serviceCode}`,
        amount: `${amount}`,
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
          `${APP_PREFIX_REDIS}:reports:count:purchases_ElectricityWithWallet:${moment().format(
            "DMMYYYY"
          )}`
        );
        // expireReportsInRedis(
        //   `${APP_PREFIX_REDIS}:reports:count:purchases_ElectricityWithWallet:${moment().format(
        //     "DMMYYYY"
        //   )}`
        // );
        await redisClient.incrbyAsync(
          `${APP_PREFIX_REDIS}:reports:count:totalValue_ElectricityWithWallet:${moment().format(
            "DMMYYYY"
          )}`,
          parseInt(amount)
        );
        // expireReportsInRedis(
        //   `${APP_PREFIX_REDIS}:reports:count:totalValue_ElectricityWithWallet:${moment().format(
        //     "DMMYYYY"
        //   )}`
        // );
        resolve(`END Dear Customer, your payment was successful!`);
      } else {
        console.log("Getting response from coral pay");
        await redisClient.incrAsync(
          `${APP_PREFIX_REDIS}:reports:count:purchases_ElectricityWithMyBankUSSD:${moment().format(
            "DMMYYYY"
          )}`
        );
        // expireReportsInRedis(
        //   `${APP_PREFIX_REDIS}:reports:count:purchases_ElectricityWithMyBankUSSD:${moment().format(
        //     "DMMYYYY"
        //   )}`
        // );
        await redisClient.incrbyAsync(
          `${APP_PREFIX_REDIS}:reports:count:totalValue_ElectricityWithMyBankUSSD:${moment().format(
            "DMMYYYY"
          )}`,
          parseInt(amount)
        );
        // expireReportsInRedis(
        //   `${APP_PREFIX_REDIS}:reports:count:totalValue_ElectricityWithMyBankUSSD:${moment().format(
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

async function fetchDiscoDetails() {
  return new Promise((resolve) => {
    axios
      .get(`${FelaMarketPlace.BASE_URL}/list/electricityProviders`, {
        headers: felaHeader,
      })
      .then(async (response) => {
        let discos = response.data.data;
        let prepaidScore = 1;
        let postpaidScore = 1;

        let keys = Object.keys(discos);
        for (let key of keys) {
          let packages = discos[key].packages;

          for (let item of packages) {
            if (item.code === "prepaid") {
              await redisClient.zaddAsync(
                `${APP_PREFIX_REDIS}:Discos:Prepaid:Title`,
                prepaidScore,
                `${discos[key].title}`
              );
              await redisClient.zaddAsync(
                `${APP_PREFIX_REDIS}:Discos:Prepaid:Code`,
                prepaidScore,
                `${discos[key].code}`
              );
              console.log(API_DATA_EXPIRE_TIME);
              redisClient.expire(
                `${APP_PREFIX_REDIS}:Discos:Prepaid:Code`,
                API_DATA_EXPIRE_TIME
              );
              redisClient.expire(
                `${APP_PREFIX_REDIS}:Discos:Prepaid:Code`,
                API_DATA_EXPIRE_TIME
              );
            }

            if (item.code === "postpaid") {
              await redisClient.zaddAsync(
                `${APP_PREFIX_REDIS}:Discos:Postpaid:Title`,
                postpaidScore,
                `${discos[key].title}`
              );
              await redisClient.zaddAsync(
                `${APP_PREFIX_REDIS}:Discos:Postpaid:Code`,
                postpaidScore,
                `${discos[key].code}`
              );
              redisClient.expire(
                `${APP_PREFIX_REDIS}:Discos:Postpaid:Title`,
                API_DATA_EXPIRE_TIME
              );
              redisClient.expire(
                `${APP_PREFIX_REDIS}:Discos:Postpaid:Code`,
                API_DATA_EXPIRE_TIME
              );
            }
          }
          prepaidScore++;
          postpaidScore++;
        }
        resolve();
      })
      .catch((error) => {
        console.log("error");
        console.log(JSON.stringify(error.response.data, null, 2));
        resolve();
      });
  });
}

module.exports = {
  processElectricity,
};
