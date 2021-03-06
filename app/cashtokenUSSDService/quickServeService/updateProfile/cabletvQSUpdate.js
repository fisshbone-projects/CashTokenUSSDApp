const { redisClient } = require("$config/redisConnectConfig");
const {
  fetchCableProviders,
  displayBouquets,
  confirmSmartCardNo,
} = require("$felaLibs");
const mongoFront = require("$mongoLibs/mongoFront");
const { APP_PREFIX_REDIS, formatNumber } = require("$utils");

function updateCabletvProfile(text, phoneNumber, sessionId) {
  return new Promise(async (resolve) => {
    let brokenDownText = text.split("*");
    let response = "";
    let textlength = brokenDownText.length;

    let { providersCode, providersName } = await fetchCableProviders();
    let {
      QS_update_cabletv_providerName: chosenProvName,
      QS_update_cabletv_providerCode: chosenProvCode,
      QS_update_cabletv_processStage: processStage,
      mongo_userId,
      QS_update_cabletv_oldname: profileOldName,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

    let canEdit = !!profileOldName ? true : false;

    if (textlength === 3) {
      response = await listTopProfiles(mongo_userId);
    } else if (textlength === 4) {
      let profileName = brokenDownText[textlength - 1];
      if (profileName.length > 20 || profileName.length <= 0) {
        response = `CON Inputed beneficiary name is invalid\n\n0 Menu`;
      } else {
        let profileExist = await viewProfile(
          mongo_userId,
          profileName.toLowerCase(),
          sessionId
        );
        if (profileExist) {
          let {
            QS_update_cabletv_oldname: oldName,
          } = await redisClient.hgetallAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`
          );
          response = `CON You are updating "${oldName}" now\nUpdate Beneficiary's Name (Max 20 characters):`;
        } else {
          response = `CON The beneficiary "${profileName}" does not exist\n\n0 Menu`;
        }
      }
    } else if (textlength === 5 && canEdit) {
      let profileName = brokenDownText[textlength - 1];
      if (profileName.length >= 1 && profileName.length <= 20) {
        redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_update_cabletv_name",
          profileName.toLowerCase()
        );

        response = "CON Update Beneficiary's Provider:\n";
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
      textlength === 6 &&
      brokenDownText[textlength - 1] <= providersName.length &&
      canEdit
    ) {
      let selectedProvider = brokenDownText[textlength - 1] - 1;
      let provName = providersName[selectedProvider];
      let provCode = providersCode[selectedProvider];
      let bouquets = "";
      redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "QS_update_cabletv_providerName",
        provName,
        "QS_update_cabletv_providerCode",
        provCode,
        "QS_update_cabletv_processStage",
        "Getting bouquet"
      );
      response = `CON Update Default Bouquet:\n`;
      if (provName === "DSTV") {
        bouquets = await displayBouquets(provCode, provName, 0, 2);
      } else if (provName === "GOTV") {
        bouquets = await displayBouquets(provCode, provName, 0, -1);
      }
      response += bouquets;
    } else if (
      textlength === 7 &&
      chosenProvName === "GOTV" &&
      Number(brokenDownText[textlength - 1]) <= 8 &&
      canEdit
    ) {
      let selectedBouquet = Number(brokenDownText[textlength - 1]) - 1;
      await saveSelectedBouquet(chosenProvCode, selectedBouquet, sessionId);

      response = "CON Update Beneficiary's Smartcard Number:";
    } else if (
      [7, 8, 9, 10, 11, 12, 13].includes(textlength) &&
      chosenProvName === "DSTV" &&
      processStage === "Getting bouquet" &&
      canEdit
    ) {
      let userResponse = Number(brokenDownText[textlength - 1]);
      let displayBouquetStart = 0;
      let displayBouquetEnd = 0;
      let displayBouquetShowAt = 0;
      let selectedBouquet = 0;

      switch (textlength) {
        case 7:
          selectedBouquet = userResponse - 1;
          displayBouquetShowAt = 3;
          displayBouquetStart = 3;
          displayBouquetEnd = 6;
          break;
        case 8:
          selectedBouquet = userResponse + 2;
          displayBouquetShowAt = 4;
          displayBouquetStart = 7;
          displayBouquetEnd = 11;
          break;
        case 9:
          selectedBouquet = userResponse + 6;
          displayBouquetShowAt = 5;
          displayBouquetStart = 12;
          displayBouquetEnd = 15;
          break;
        case 10:
          selectedBouquet = userResponse + 11;
          displayBouquetShowAt = 4;
          displayBouquetStart = 16;
          displayBouquetEnd = 19;
          break;
        case 11:
          selectedBouquet = userResponse + 15;
          displayBouquetShowAt = 4;
          displayBouquetStart = 20;
          displayBouquetEnd = 25;
          break;
        case 12:
          selectedBouquet = userResponse + 19;
          displayBouquetShowAt = 6;
          displayBouquetStart = 26;
          displayBouquetEnd = -1;
          break;
        case 13:
          selectedBouquet = userResponse + 25;
          displayBouquetShowAt = 7;
          break;
      }

      if (userResponse <= displayBouquetShowAt) {
        await saveSelectedBouquet(chosenProvCode, selectedBouquet, sessionId);
        response = "CON Enter Beneficiary's Smartcard Number:";
      } else if (userResponse > displayBouquetShowAt) {
        if (textlength === 13) {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        } else {
          response = `CON Update Default Bouquet:\n`;
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
    } else if (textlength === 8 && chosenProvName === "GOTV" && canEdit) {
      let smartCardNo = brokenDownText[textlength - 1];
      let {
        QS_update_cabletv_providerCode,
        QS_update_cabletv_bouquetCode,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

      let confirmCardNo = await confirmSmartCardNo(
        smartCardNo,
        QS_update_cabletv_providerCode,
        QS_update_cabletv_bouquetCode
      );

      if (confirmCardNo) {
        await redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_update_cabletv_cardNo",
          smartCardNo
        );
        response = await generateSummary(sessionId);
      } else {
        response = "CON Error! Smartcard number cannot be verified\n\n0 Menu";
      }
    } else if (
      [8, 9, 10, 11, 12, 13, 14].includes(textlength) &&
      chosenProvName === "DSTV" &&
      processStage === "Getting cardNo" &&
      canEdit
    ) {
      let smartCardNo = brokenDownText[textlength - 1];
      let {
        QS_update_cabletv_providerCode,
        QS_update_cabletv_bouquetCode,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

      let confirmCardNo = await confirmSmartCardNo(
        smartCardNo,
        QS_update_cabletv_providerCode,
        QS_update_cabletv_bouquetCode
      );

      if (confirmCardNo) {
        await redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_update_cabletv_cardNo",
          smartCardNo,
          "QS_update_cabletv_processStage",
          "Confirming"
        );
        response = await generateSummary(sessionId);
      } else {
        response = "CON Error! Smartcard number cannot be verified\n\n0 Menu";
      }
    } else if (textlength === 9 && chosenProvName === "GOTV" && canEdit) {
      let userSelection = brokenDownText[textlength - 1];
      if (userSelection === "2") {
        response = "END Beneficiary creation process canceled by user";
      } else if (userSelection === "1") {
        response = await updateBeneficiary(sessionId);
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else if (
      [9, 10, 11, 12, 13, 14, 15].includes(textlength) &&
      chosenProvName === "DSTV" &&
      processStage === "Confirming" &&
      canEdit
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
      QS_update_cabletv_name,
      QS_update_cabletv_providerName,
      QS_update_cabletv_bouquetName,
      QS_update_cabletv_bouquetPrice,
      QS_update_cabletv_cardNo,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
    let response = "";

    response = `CON Confirm:\nName: ${QS_update_cabletv_name}\nProvider: ${QS_update_cabletv_providerName}\nBouquet: ${QS_update_cabletv_bouquetName}\nCardNo: ${QS_update_cabletv_cardNo}\nPrice: ${formatNumber(
      QS_update_cabletv_bouquetPrice
    )}\n\n1 Confirm\n2 Cancel`;

    resolve(response);
  });
}

function updateBeneficiary(sessionId) {
  return new Promise(async (resolve) => {
    let response = "";
    let {
      mongo_userId,
      QS_update_cabletv_name,
      QS_update_cabletv_providerName,
      QS_update_cabletv_providerCode,
      QS_update_cabletv_bouquetName,
      QS_update_cabletv_bouquetCode,
      QS_update_cabletv_bouquetPrice,
      QS_update_cabletv_cardNo,
      QS_update_cabletv_profileID,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
    let cabletvDoc = {
      name: QS_update_cabletv_name,
      providerName: QS_update_cabletv_providerName,
      providerCode: QS_update_cabletv_providerCode,
      cardNumber: QS_update_cabletv_cardNo,
      defaultBouquetName: QS_update_cabletv_bouquetName,
      defaultBouquetCode: QS_update_cabletv_bouquetCode,
      defaultBouquetPrice: QS_update_cabletv_bouquetPrice,
      customer: mongo_userId,
      updatedAt: Date.now(),
    };
    let updated = await mongoFront.updateProfile(
      QS_update_cabletv_profileID,
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
      "QS_update_cabletv_bouquetName",
      `${selectedBouquetName}`,
      "QS_update_cabletv_bouquetCode",
      `${selectedBouquetCode}`,
      "QS_update_cabletv_bouquetPrice",
      `${bouquetPrice}`,
      "QS_update_cabletv_processStage",
      "Getting cardNo"
    );

    resolve();
  });
}

function viewProfile(mongo_userId, profileName, sessionId) {
  return new Promise(async (resolve) => {
    let profile = await mongoFront.findExistingProfile(
      mongo_userId,
      profileName,
      "cabletv"
    );
    if (profile) {
      let { name, _id } = profile;
      await redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "QS_update_cabletv_oldname",
        name,
        "QS_update_cabletv_profileID",
        _id.toString()
      );
      resolve(true);
    } else {
      resolve(false);
    }
  });
}

function listTopProfiles(mongo_userId) {
  return new Promise(async (resolve) => {
    let response = "";
    let profiles = await mongoFront.getTopProfiles(mongo_userId, "cabletv");
    if (profiles.length === 0) {
      response = `CON You do not have any top beneficiaries yet. Create some beneficiaries to see them here\n\n0 Menu`;
    } else {
      response = `CON Below are some of your top beneficiaries:\n`;
      for (let profile of profiles) {
        response += `- ${profile}\n`;
      }
      response += `Enter the name of a beneficiary to view:`;
    }

    resolve(response);
  });
}

module.exports = { updateCabletvProfile };
