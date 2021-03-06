const { redisClient } = require("$config/redisConnectConfig");
const {
  fetchCableProviders,
  displayBouquets,
  confirmSmartCardNo,
} = require("$felaLibs");
const mongoFront = require("$mongoLibs/mongoFront");
const { APP_PREFIX_REDIS, formatNumber } = require("$utils");

function createCabletvProfile(text, phoneNumber, sessionId) {
  return new Promise(async (resolve) => {
    let brokenDownText = text.split("*");
    let response = "";
    let textlength = brokenDownText.length;

    let { providersCode, providersName } = await fetchCableProviders();
    let {
      QS_Cabletv_providerName: chosenProvName,
      QS_Cabletv_providerCode: chosenProvCode,
      QS_Cabletv_processStage: processStage,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

    if (textlength === 3) {
      response = "CON Enter Beneficiary's Name (Max 20 characters):";
    } else if (textlength === 4) {
      let profileName = brokenDownText[textlength - 1];
      if (profileName.length >= 1 && profileName.length <= 20) {
        redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_Cabletv_name",
          profileName.toLowerCase()
        );

        response = "CON Select Beneficiary's Provider:\n";
        providersName.forEach((provider, index) => {
          response += `${++index} ${provider}\n`;
        });
      } else {
        console.log("Beneficiary's Name inputed is more than 20 characters");
        if (profileName.length < 1) {
          response = "CON Error! Name field cannot be empty\n\n0 Menu";
        } else {
          response =
            "CON Error! Beneficiary's name can only be 20 characters long or less\n\n0 Menu";
        }
      }
    } else if (
      textlength === 5 &&
      brokenDownText[textlength - 1] <= providersName.length
    ) {
      let selectedProvider = brokenDownText[textlength - 1] - 1;
      let provName = providersName[selectedProvider];
      let provCode = providersCode[selectedProvider];
      let bouquets = "";
      redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "QS_Cabletv_providerName",
        provName,
        "QS_Cabletv_providerCode",
        provCode,
        "QS_Cabletv_processStage",
        "Getting bouquet"
      );
      response = `CON Select Default Bouquet:\n`;
      if (provName === "DSTV") {
        bouquets = await displayBouquets(provCode, provName, 0, 2);
      } else if (provName === "GOTV") {
        bouquets = await displayBouquets(provCode, provName, 0, -1);
      }
      response += bouquets;
    } else if (
      textlength === 6 &&
      chosenProvName === "GOTV" &&
      Number(brokenDownText[textlength - 1]) <= 8
    ) {
      let selectedBouquet = Number(brokenDownText[textlength - 1]) - 1;
      await saveSelectedBouquet(chosenProvCode, selectedBouquet, sessionId);

      response = "CON Enter Beneficiary's Smartcard Number:";
    } else if (
      [6, 7, 8, 9, 10, 11, 12].includes(textlength) &&
      chosenProvName === "DSTV" &&
      processStage === "Getting bouquet"
    ) {
      let userResponse = Number(brokenDownText[textlength - 1]);
      let displayBouquetStart = 0;
      let displayBouquetEnd = 0;
      let displayBouquetShowAt = 0;
      let selectedBouquet = 0;

      switch (textlength) {
        case 6:
          selectedBouquet = userResponse - 1;
          displayBouquetShowAt = 3;
          displayBouquetStart = 3;
          displayBouquetEnd = 6;
          break;
        case 7:
          selectedBouquet = userResponse + 2;
          displayBouquetShowAt = 4;
          displayBouquetStart = 7;
          displayBouquetEnd = 11;
          break;
        case 8:
          selectedBouquet = userResponse + 6;
          displayBouquetShowAt = 5;
          displayBouquetStart = 12;
          displayBouquetEnd = 15;
          break;
        case 9:
          selectedBouquet = userResponse + 11;
          displayBouquetShowAt = 4;
          displayBouquetStart = 16;
          displayBouquetEnd = 19;
          break;
        case 10:
          selectedBouquet = userResponse + 15;
          displayBouquetShowAt = 4;
          displayBouquetStart = 20;
          displayBouquetEnd = 25;
          break;
        case 11:
          selectedBouquet = userResponse + 19;
          displayBouquetShowAt = 6;
          displayBouquetStart = 26;
          displayBouquetEnd = -1;
          break;
        case 12:
          selectedBouquet = userResponse + 25;
          displayBouquetShowAt = 7;
          break;
      }

      if (userResponse <= displayBouquetShowAt) {
        await saveSelectedBouquet(chosenProvCode, selectedBouquet, sessionId);
        response = "CON Enter Beneficiary's Smartcard Number:";
      } else if (userResponse > displayBouquetShowAt) {
        if (textlength === 12) {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        } else {
          response = `CON Select Default Bouquet:\n`;
          bouquets = await displayBouquets(
            chosenProvCode,
            chosenProvName,
            displayBouquetStart,
            displayBouquetEnd
          );
          response += bouquets;
        }
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else if (textlength === 7 && chosenProvName === "GOTV") {
      let smartCardNo = brokenDownText[textlength - 1];
      let {
        QS_Cabletv_providerCode,
        QS_Cabletv_bouquetCode,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

      let confirmCardNo = await confirmSmartCardNo(
        smartCardNo,
        QS_Cabletv_providerCode,
        QS_Cabletv_bouquetCode
      );

      if (confirmCardNo) {
        await redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_Cabletv_cardNo",
          smartCardNo
        );
        response = await generateSummary(sessionId);
      } else {
        response = "CON Error! Smartcard number cannot be verified\n\n0 Menu";
      }
    } else if (
      [7, 8, 9, 10, 11, 12, 13].includes(textlength) &&
      chosenProvName === "DSTV" &&
      processStage === "Getting cardNo"
    ) {
      let smartCardNo = brokenDownText[textlength - 1];
      let {
        QS_Cabletv_providerCode,
        QS_Cabletv_bouquetCode,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

      let confirmCardNo = await confirmSmartCardNo(
        smartCardNo,
        QS_Cabletv_providerCode,
        QS_Cabletv_bouquetCode
      );

      if (confirmCardNo) {
        await redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_Cabletv_cardNo",
          smartCardNo,
          "QS_Cabletv_processStage",
          "Confirming"
        );
        response = await generateSummary(sessionId);
      } else {
        response = "CON Error! Smartcard number cannot be verified\n\n0 Menu";
      }
    } else if (textlength === 8 && chosenProvName === "GOTV") {
      let userSelection = brokenDownText[textlength - 1];
      if (userSelection === "2") {
        response = "END Beneficiary creation process canceled by user";
      } else if (userSelection === "1") {
        response = await createBeneficiary(sessionId);
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else if (
      [8, 9, 10, 11, 12, 13, 14].includes(textlength) &&
      chosenProvName === "DSTV" &&
      processStage === "Confirming"
    ) {
      let userSelection = brokenDownText[textlength - 1];
      if (userSelection === "2") {
        response = "END Beneficiary creation process canceled by user";
      } else if (userSelection === "1") {
        response = await createBeneficiary(sessionId);
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else if (textlength === 9 && chosenProvName === "GOTV") {
      let userSelection = brokenDownText[textlength - 1];
      if (userSelection === "2") {
        response = "END Beneficiary creation process canceled by user";
      } else if (userSelection === "1") {
        response = await updateBeneficiary(sessionId);
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else if (
      [9, 10, 11, 12, 13, 14, 15] &&
      chosenProvName === "DSTV" &&
      processStage === "Updating Profile"
    ) {
      let userSelection = brokenDownText[textlength - 1];
      if (userSelection === "2") {
        response = "END Beneficiary creation process canceled by user";
      } else if (userSelection === "1") {
        response = await updateBeneficiary(sessionId);
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else {
      response = "CON Error! Wrong option inputed\n\n0 Menu";
    }

    resolve(response);
  });
}

function generateSummary(sessionId) {
  return new Promise(async (resolve) => {
    let {
      QS_Cabletv_name,
      QS_Cabletv_providerName,
      QS_Cabletv_bouquetName,
      QS_Cabletv_bouquetPrice,
      QS_Cabletv_cardNo,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
    let response = "";

    response = `CON Confirm:\nName: ${QS_Cabletv_name}\nProvider: ${QS_Cabletv_providerName}\nBouquet: ${QS_Cabletv_bouquetName}\nCardNo: ${QS_Cabletv_cardNo}\nPrice: ${formatNumber(
      QS_Cabletv_bouquetPrice
    )}\n\n1 Confirm\n2 Cancel`;

    resolve(response);
  });
}

function updateBeneficiary(sessionId) {
  return new Promise(async (resolve) => {
    let response = "";
    let {
      mongo_userId,
      QS_Cabletv_name,
      QS_Cabletv_providerName,
      QS_Cabletv_providerCode,
      QS_Cabletv_bouquetName,
      QS_Cabletv_bouquetCode,
      QS_Cabletv_bouquetPrice,
      QS_Cabletv_cardNo,
      QS_Cabletv_oldProfileId,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
    let cabletvDoc = {
      name: QS_Cabletv_name,
      providerName: QS_Cabletv_providerName,
      providerCode: QS_Cabletv_providerCode,
      cardNumber: QS_Cabletv_cardNo,
      defaultBouquetName: QS_Cabletv_bouquetName,
      defaultBouquetCode: QS_Cabletv_bouquetCode,
      defaultBouquetPrice: QS_Cabletv_bouquetPrice,
      customer: mongo_userId,
      updatedAt: Date.now(),
    };
    let updated = await mongoFront.updateProfile(
      QS_Cabletv_oldProfileId,
      cabletvDoc,
      "cabletv"
    );
    if (!!updated) {
      response = "END Beneficiary updated successfully!";
    } else {
      response =
        "END There was an error saving beneficiary.\nPlease try again later";
    }
    resolve(response);
  });
}

function createBeneficiary(sessionId) {
  return new Promise(async (resolve) => {
    let response = "";
    let {
      mongo_userId,
      QS_Cabletv_name,
      QS_Cabletv_providerName,
      QS_Cabletv_providerCode,
      QS_Cabletv_bouquetName,
      QS_Cabletv_bouquetCode,
      QS_Cabletv_bouquetPrice,
      QS_Cabletv_cardNo,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

    let beneficiaryExists = await mongoFront.findExistingProfile(
      mongo_userId,
      QS_Cabletv_name,
      "cabletv"
    );

    if (!beneficiaryExists) {
      console.log("Creating a new cabletv beneficiary");
      let cabletvDoc = {
        name: QS_Cabletv_name,
        providerName: QS_Cabletv_providerName,
        providerCode: QS_Cabletv_providerCode,
        cardNumber: QS_Cabletv_cardNo,
        defaultBouquetName: QS_Cabletv_bouquetName,
        defaultBouquetCode: QS_Cabletv_bouquetCode,
        defaultBouquetPrice: QS_Cabletv_bouquetPrice,
        customer: mongo_userId,
      };
      let newId = await mongoFront.createProfile(cabletvDoc, "cabletv");
      if (newId) {
        response = "END Beneficiary created successfully!";
      } else {
        response =
          "END There was an error saving beneficiary.\nPlease try again later";
      }
    } else {
      console.log("Updating beneficiary from create state");
      await redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "QS_Cabletv_oldProfileId",
        beneficiaryExists._id.toString(),
        "QS_Cabletv_processStage",
        "Updating Profile"
      );
      response = `CON You currently have a beneficiary with the name '${QS_Cabletv_name}'. Will you like to update this beneficiary instead?\n\n1 Yes\n2 No`;
    }
    resolve(response);
  });
}

function saveSelectedBouquet(providerCode, selectedBouquet, sessionId) {
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
    redisClient.hmsetAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`,
      "QS_Cabletv_bouquetName",
      `${selectedBouquetName}`,
      "QS_Cabletv_bouquetCode",
      `${selectedBouquetCode}`,
      "QS_Cabletv_bouquetPrice",
      `${bouquetPrice}`,
      "QS_Cabletv_processStage",
      "Getting cardNo"
    );

    resolve();
  });
}

module.exports = { createCabletvProfile };
