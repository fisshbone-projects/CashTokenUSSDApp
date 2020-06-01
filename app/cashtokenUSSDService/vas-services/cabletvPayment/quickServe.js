const { redisClient } = require("$config/redisConnectConfig");
const axios = require("axios");
const {
  APP_PREFIX_REDIS,
  expireReportsInRedis,
  MYBANKUSSD_BANK_CODES,
  formatNumber,
} = require("$utils");
const { FelaMarketPlace, App } = require("$config");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
const mongoFront = require("$mongoLibs/mongoFront");
const moment = require("moment");

function quickServe(phoneNumber, text, sessionId) {
  return new Promise(async (resolve) => {
    let response = "";
    let brokenDownText = text.split("*");
    let textLength = brokenDownText.length;
    let {
      mongo_userId,
      Cabletv_QS_profileListed: hasProfiles,
      Cabletv_QS_profileViewed: profileViewed,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

    if (textLength === 3) {
      await redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "cabletv_purchase_method",
        "quickServe"
      );
      response = await listTopProfiles(mongo_userId, sessionId);
    } else if (textLength === 4 && hasProfiles) {
      let profileName = brokenDownText[textLength - 1].toLowerCase();
      response = await viewProfile(mongo_userId, profileName, sessionId);
    } else if (textLength === 5 && profileViewed) {
      let userResponse = brokenDownText[textLength - 1];
      if (userResponse === "1") {
        response = `CON Select payment method:\n1 My Wallet\n2 MyBankUSSD`;
      } else {
        response = `CON Error!\nInvalid response entered\n\nEnter 0 Back to home menu`;
      }
    } else if (textLength === 6 && profileViewed) {
      let paymentMethod = brokenDownText[textLength - 1];

      if (paymentMethod === "1" || paymentMethod === "2") {
        if (paymentMethod === "1") {
          await redisClient.hsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "Cabletv_QS_paymentMethod",
            "felawallet"
          );
          response = "CON Enter your wallet PIN:";
        } else {
          await redisClient.hsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "Cabletv_QS_paymentMethod",
            "coralpay"
          );
          response = displayMyBankUSSDBanks();
        }
      }
    } else if (textLength === 7 && profileViewed) {
      let {
        Cabletv_QS_paymentMethod: paymentMethod,
        Cabletv_QS_profileId: profileId,
        Cabletv_QS_providerCode: providerCode,
        Cabletv_QS_cardNo: cardNo,
        Cabletv_QS_bouquetCode: bouquetCode,
        Cabletv_QS_bouquetPrice: price,
        Cable_QS_profileSuccessfulTrans: successfulTran,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

      if (paymentMethod === "felawallet") {
        let walletPin = brokenDownText[textLength - 1];
        if (/^[0-9]*$/.test(walletPin)) {
          response = await processCableTVPayment(
            sessionId,
            phoneNumber,
            cardNo,
            providerCode,
            bouquetCode,
            paymentMethod,
            price,
            profileId,
            successfulTran,
            walletPin
          );
        } else {
          console.log("PIN is invalid");
          response = `CON Error!\nPIN can only be numbers\n\nEnter 0 Back to home menu`;
        }
      } else if (paymentMethod === "coralpay") {
        let userResponse = brokenDownText[textLength - 1];
        if (
          Number(userResponse) <= Object.values(MYBANKUSSD_BANK_CODES).length
        ) {
          let chosenUSSDBankCode = Object.values(MYBANKUSSD_BANK_CODES)[
            Number(userResponse) - 1
          ];

          response = await processCableTVPayment(
            sessionId,
            phoneNumber,
            cardNo,
            providerCode,
            bouquetCode,
            paymentMethod,
            price,
            profileId,
            successfulTran,
            undefined,
            chosenUSSDBankCode
          );
        } else {
          response = `CON Error!\nInvalid response entered\n\nEnter 0 Back to home menu`;
        }
      }
    } else if (!hasProfiles) {
      response = `CON You do not have any top beneficiaries yet. Create some beneficiaries to see them here\n\n0 Menu`;
    } else {
      response = `CON Error!\nInvalid response entered\n\nEnter 0 Back to home menu`;
    }

    resolve(response);
  });
}

function viewProfile(mongo_userId, profileName, sessionId) {
  return new Promise(async (resolve) => {
    let response = "";
    let profile = await mongoFront.findExistingProfile(
      mongo_userId,
      profileName,
      "cabletv"
    );
    if (profile) {
      let {
        _id,
        name,
        providerName,
        providerCode,
        cardNumber,
        defaultBouquetName,
        defaultBouquetCode,
        defaultBouquetPrice,
        successfulTransactions = 0,
      } = profile;

      await redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "Cabletv_QS_profileId",
        _id.toString(),
        "Cabletv_QS_profileName",
        name,
        "Cabletv_QS_providerName",
        providerName,
        "Cabletv_QS_providerCode",
        providerCode,
        "Cabletv_QS_cardNo",
        cardNumber,
        "Cabletv_QS_bouquetName",
        defaultBouquetName,
        "Cabletv_QS_bouquetCode",
        defaultBouquetCode,
        "Cabletv_QS_bouquetPrice",
        defaultBouquetPrice,
        "Cable_QS_profileSuccessfulTrans",
        successfulTransactions,
        "Cabletv_QS_profileViewed",
        "true"
      );

      response = `CON Name: ${name}\nProvider: ${providerName}\nCardNo: ${cardNumber}\nBouquet: ${defaultBouquetName}\nPrice: ${formatNumber(
        defaultBouquetPrice
      )}\nTimesUsed: ${formatNumber(
        successfulTransactions
      )}\n\n1 Continue\n0 Cancel`;
    } else {
      response = `CON The beneficiary "${profileName}" does not exist\n\n0 Menu`;
    }

    resolve(response);
  });
}

function listTopProfiles(mongo_userId, sessionId) {
  return new Promise(async (resolve) => {
    let response = "";
    let profiles = await mongoFront.getTopProfiles(mongo_userId, "cabletv");
    if (profiles.length === 0) {
      response = `CON You do not have any top beneficiaries yet. Create some beneficiaries to see them here\n\n0 Menu`;
    } else {
      await redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "Cabletv_QS_profileListed",
        "true"
      );
      response = `CON Below are some of your top beneficiaries:\n`;
      for (let profile of profiles) {
        response += `- ${profile}\n`;
      }
      response += `Enter the name of a beneficiary to view:`;
    }

    resolve(response);
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

function processCableTVPayment(
  sessionId,
  phoneNumber,
  cardNo,
  providerCode,
  bouquetCode,
  paymentMethod,
  price,
  profileId,
  successfulTran,
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

    console.log(payload);

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
        updateProfileSuccessTran(profileId, successfulTran);
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
        updateProfileSuccessTran(profileId, successfulTran);
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

function updateProfileSuccessTran(profileId, successfulTran) {
  return new Promise(async (resolve) => {
    let updateTran = Number(successfulTran);
    ++updateTran;
    let doc = {
      successfulTransactions: updateTran.toString(),
      updatedAt: Date.now(),
    };
    await mongoFront.updateProfile(profileId, doc, "cabletv");
    resolve();
  });
}

module.exports = { quickServe };
