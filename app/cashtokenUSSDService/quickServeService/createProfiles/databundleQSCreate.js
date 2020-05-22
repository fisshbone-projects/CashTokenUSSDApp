const { redisClient } = require("$config/redisConnectConfig");
const { getDataProviders, displayBundles } = require("$felaLibs");
const mongoFront = require("$mongoLibs/mongoFront");
const {
  APP_PREFIX_REDIS,
  testPhoneNumber,
  sanitizePhoneNumber,
  formatNumber,
} = require("$utils");

function createDatabundleProfile(text, phoneNumber, sessionId) {
  return new Promise(async (resolve) => {
    let brokenDownText = text.split("*");
    let response = "";
    let textlength = brokenDownText.length;

    let { providersName, providersCode } = await getDataProviders();

    if (textlength === 3) {
      response = "CON Enter Beneficiary's Name (Max 20 characters):";
    } else if (textlength === 4) {
      let profileName = brokenDownText[textlength - 1];
      if (profileName.length >= 1 && profileName.length <= 20) {
        redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_Data_name",
          profileName.toLowerCase()
        );

        response = "CON Select Beneficiary's Network:\n";
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
      let selectedNetwork = brokenDownText[textlength - 1] - 1;
      redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "QS_Data_networkName",
        providersName[selectedNetwork],
        "QS_Data_networkCode",
        providersCode[selectedNetwork]
      );
      response = `CON Enter Beneficiary's Phone Number:`;
    } else if (textlength === 6) {
      let inputedBeneficiarysNo = brokenDownText[textlength - 1];
      let bundles = "";
      let { QS_Data_networkCode: networkCode } = await redisClient.hgetallAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`
      );
      if (
        testPhoneNumber(inputedBeneficiarysNo) ||
        (networkCode === "Smile" && /^[0-9]*$/.test(inputedBeneficiarysNo)) ||
        (networkCode === "Spectranet" && /^[0-9]*$/.test(inputedBeneficiarysNo))
      ) {
        redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_Data_phoneNumber",
          sanitizePhoneNumber(inputedBeneficiarysNo)
        );

        switch (networkCode) {
          case "MTN":
            bundles = await displayBundles(networkCode, 0, 6);
            break;
          case "Airtel":
            bundles = await displayBundles(networkCode, 0, 7);
            break;
          case "Etisalat":
            bundles = await displayBundles(networkCode, 0, 7);
            break;
          case "Smile":
            bundles = await displayBundles(networkCode, 0, 5);
            break;
          case "Spectranet":
            bundles = await displayBundles(networkCode, 0, -1);
            break;
        }

        response = "CON Select Bundle:\n";
        response += bundles;
      } else {
        response = "CON Error! Inputed phone number is not valid\n\n0 Menu";
      }
    } else {
      let { QS_Data_networkCode: networkCode } = await redisClient.hgetallAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`
      );

      switch (networkCode) {
        case "MTN":
          response = await handleMTN(brokenDownText, sessionId);
          break;
        case "Airtel":
          response = await handleAirtel(brokenDownText, sessionId);
          break;
        case "Etisalat":
          response = await handleEtisalat(brokenDownText, sessionId);
          break;
        case "Smile":
          response = await handleSmile(brokenDownText, sessionId);
          break;
        case "Spectranet":
          response = await handleSpectranet(brokenDownText, sessionId);
          break;
      }
    }

    resolve(response);
  });
}

function handleAirtel(brokenDownText, sessionId) {
  return new Promise(async (resolve) => {
    let textlength = brokenDownText.length;
    let response = "";
    let { QS_Data_stage: ussdStage } = await redisClient.hgetallAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`
    );
    if (textlength === 7) {
      let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (selectedBundle <= 8 && selectedBundle >= 1) {
        await saveUserBundleData(sessionId, selectedBundle - 1, "Airtel");
        response = await generateSummary(sessionId);
      } else if (selectedBundle === 9) {
        response = "CON Select Bundle:\n";
        let bundles = await displayBundles("Airtel", 8, -1);
        response += bundles;
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else if (textlength === 8) {
      let userResponse = brokenDownText[textlength - 1];
      let selectedBundle = Number(brokenDownText[textlength - 1]);

      if (ussdStage === "Picked bundle") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await saveBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      } else {
        if (selectedBundle <= 8 && selectedBundle >= 1) {
          await saveUserBundleData(sessionId, selectedBundle + 7, "Airtel");
          response = await generateSummary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      }
    } else if (textlength === 9) {
      let userResponse = brokenDownText[textlength - 1];
      if (ussdStage === "Updating Profile") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await updateBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      } else {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await saveBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      }
    } else if (textlength === 10) {
      let userResponse = brokenDownText[textlength - 1];
      if (userResponse === "2") {
        response = "END Beneficiary creation process canceled by user";
      } else if (userResponse === "1") {
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

function handleEtisalat(brokenDownText, sessionId) {
  return new Promise(async (resolve) => {
    let textlength = brokenDownText.length;
    let response = "";
    let { QS_Data_stage: ussdStage } = await redisClient.hgetallAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`
    );
    if (textlength === 7) {
      let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (selectedBundle <= 8 && selectedBundle >= 1) {
        await saveUserBundleData(sessionId, selectedBundle - 1, "Etisalat");
        response = await generateSummary(sessionId);
      } else if (selectedBundle === 9) {
        response = "CON Select Bundle:\n";
        let bundles = await displayBundles("Etisalat", 8, -1);
        response += bundles;
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else if (textlength === 8) {
      let userResponse = brokenDownText[textlength - 1];
      let selectedBundle = Number(brokenDownText[textlength - 1]);

      if (ussdStage === "Picked bundle") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await saveBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      } else {
        if (selectedBundle <= 8 && selectedBundle >= 1) {
          await saveUserBundleData(sessionId, selectedBundle + 7, "Etisalat");
          response = await generateSummary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      }
    } else if (textlength === 9) {
      let userResponse = brokenDownText[textlength - 1];
      if (ussdStage === "Updating Profile") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await updateBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      } else {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await saveBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      }
    } else if (textlength === 10) {
      let userResponse = brokenDownText[textlength - 1];
      if (userResponse === "2") {
        response = "END Beneficiary creation process canceled by user";
      } else if (userResponse === "1") {
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

function handleSpectranet(brokenDownText, sessionId) {
  return new Promise(async (resolve) => {
    let textlength = brokenDownText.length;
    let response = "";
    if (textlength === 7) {
      let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (selectedBundle <= 6 && selectedBundle >= 1) {
        await saveUserBundleData(sessionId, selectedBundle - 1, "Spectranet");
        response = await generateSummary(sessionId);
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else if (textlength === 8) {
      let userResponse = brokenDownText[textlength - 1];
      if (userResponse === "2") {
        response = "END Beneficiary creation process canceled by user";
      } else if (userResponse === "1") {
        response = await saveBeneficiary(sessionId);
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else if (textlength === 9) {
      let userResponse = brokenDownText[textlength - 1];
      if (userResponse === "2") {
        response = "END Beneficiary creation process canceled by user";
      } else if (userResponse === "1") {
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

function saveBeneficiary(sessionId) {
  return new Promise(async (resolve) => {
    let response = "";
    let {
      mongo_userId,
      QS_Data_name,
      QS_Data_networkName,
      QS_Data_networkCode,
      QS_Data_phoneNumber,
      QS_Data_bundleName,
      QS_Data_bundleCode,
      QS_Data_bundlePrice,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

    let beneficiaryExists = await mongoFront.findExistingProfile(
      mongo_userId,
      QS_Data_name,
      "databundle"
    );

    if (!beneficiaryExists) {
      console.log("Creating a new databundle beneficiary");
      let dataDoc = {
        name: QS_Data_name,
        networkName: QS_Data_networkName,
        networkCode: QS_Data_networkCode,
        phoneNumber: QS_Data_phoneNumber,
        defaultBundleName: QS_Data_bundleName,
        defaultBundleCode: QS_Data_bundleCode,
        defaultBundlePrice: QS_Data_bundlePrice,
        customer: mongo_userId,
      };
      let newId = await mongoFront.createProfile(dataDoc, "databundle");
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
        "QS_Data_oldProfileId",
        beneficiaryExists._id.toString(),
        "QS_Data_stage",
        "Updating Profile"
      );
      response = `CON You currently have a beneficiary with the name '${QS_Data_name}'. Will you like to update this beneficiary instead?\n\n1 Yes\n2 No`;
    }
    resolve(response);
  });
}

function updateBeneficiary(sessionId) {
  return new Promise(async (resolve) => {
    let response = "";
    let {
      mongo_userId,
      QS_Data_name,
      QS_Data_networkName,
      QS_Data_networkCode,
      QS_Data_phoneNumber,
      QS_Data_bundleName,
      QS_Data_bundleCode,
      QS_Data_bundlePrice,
      QS_Data_oldProfileId,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
    let dataDoc = {
      name: QS_Data_name,
      networkName: QS_Data_networkName,
      networkCode: QS_Data_networkCode,
      phoneNumber: QS_Data_phoneNumber,
      defaultBundleName: QS_Data_bundleName,
      defaultBundleCode: QS_Data_bundleCode,
      defaultBundlePrice: QS_Data_bundlePrice,
      customer: mongo_userId,
      updatedAt: Date.now(),
    };
    let updated = await mongoFront.updateProfile(
      QS_Data_oldProfileId,
      dataDoc,
      "databundle"
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

function saveUserBundleData(sessionId, chosenBundle, codeName) {
  return new Promise(async (resolve) => {
    if (codeName === "Smile") {
    } else {
    }
    let [chosenBundleName, dataPrice] = await redisClient.zrangeAsync(
      `${APP_PREFIX_REDIS}:${codeName}BundleNames`,
      chosenBundle,
      chosenBundle,
      "withscores"
    );

    let [chosenBundleCode] = await redisClient.zrangeAsync(
      `${APP_PREFIX_REDIS}:${codeName}BundleCodes`,
      chosenBundle,
      chosenBundle
    );

    await redisClient.hmset(
      `${APP_PREFIX_REDIS}:${sessionId}`,
      "QS_Data_bundleName",
      chosenBundleName,
      "QS_Data_bundleCode",
      chosenBundleCode,
      "QS_Data_bundlePrice",
      dataPrice,
      "QS_Data_stage",
      "Picked bundle"
    );

    console.log(chosenBundleCode, chosenBundleName, dataPrice);

    resolve();
  });
}

function generateSummary(sessionId) {
  return new Promise(async (resolve) => {
    let {
      QS_Data_name,
      QS_Data_networkName,
      QS_Data_phoneNumber,
      QS_Data_bundleName,
      QS_Data_bundlePrice,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
    let response = "";
    let refinedName = "";
    if (QS_Data_networkName.includes("9mobile")) {
      refinedName = "9mobile";
    }

    response = `CON Confirm beneficiary:\nName: ${QS_Data_name}\nNetwork: ${
      refinedName === "" ? QS_Data_networkName : refinedName
    }\nPhoneNumber: ${QS_Data_phoneNumber}\nBundle: ${QS_Data_bundleName}\nPrice: ${formatNumber(
      QS_Data_bundlePrice
    )}\n\n1 Confirm\n2 Cancel`;

    resolve(response);
  });
}

module.exports = { createDatabundleProfile };
