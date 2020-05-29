const { redisClient } = require("$config/redisConnectConfig");
const { getDataProviders, displayBundles } = require("$felaLibs");
const mongoFront = require("$mongoLibs/mongoFront");
const {
  APP_PREFIX_REDIS,
  testPhoneNumber,
  sanitizePhoneNumber,
  formatNumber,
} = require("$utils");

function updateDatabundleProfile(text, phoneNumber, sessionId) {
  return new Promise(async (resolve) => {
    let brokenDownText = text.split("*");
    let response = "";
    let textlength = brokenDownText.length;

    let { providersName, providersCode } = await getDataProviders();

    let {
      mongo_userId,
      QS_update_data_oldname: profileOldName,
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
            QS_update_data_oldname: oldName,
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
          "QS_update_data_name",
          profileName.toLowerCase()
        );

        response = "CON Update Beneficiary's Network:\n";
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
    } else if (textlength === 6 && canEdit) {
      if (Number(brokenDownText[textlength - 1]) <= providersName.length) {
        let selectedNetwork = brokenDownText[textlength - 1] - 1;
        redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_update_data_networkName",
          providersName[selectedNetwork],
          "QS_update_data_networkCode",
          providersCode[selectedNetwork]
        );
        response = `CON Update Beneficiary's Phone Number:`;
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else if (textlength === 7 && canEdit) {
      let inputedBeneficiarysNo = brokenDownText[textlength - 1];
      let bundles = "";
      let {
        QS_update_data_networkCode: networkCode,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      if (
        testPhoneNumber(inputedBeneficiarysNo) ||
        (networkCode === "Spectranet" && /^[0-9]*$/.test(inputedBeneficiarysNo))
      ) {
        let numberToSave =
          networkCode === "Spectranet"
            ? inputedBeneficiarysNo
            : sanitizePhoneNumber(inputedBeneficiarysNo);
        redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_update_data_phoneNumber",
          numberToSave
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

        response = "CON Update Bundle:\n";
        response += bundles;
      } else {
        response = "CON Error! Inputed phone number is not valid\n\n0 Menu";
      }
    } else {
      let {
        QS_update_data_networkCode: networkCode,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

      switch (networkCode) {
        case "MTN":
          response = await handleMTN(brokenDownText, sessionId, canEdit);
          break;
        case "Airtel":
          response = await handleAirtel(brokenDownText, sessionId, canEdit);
          break;
        case "Etisalat":
          response = await handleEtisalat(brokenDownText, sessionId, canEdit);
          break;
        case "Smile":
          response = await handleSmile(brokenDownText, sessionId, canEdit);
          break;
        case "Spectranet":
          response = await handleSpectranet(brokenDownText, sessionId, canEdit);
          break;
        default:
          response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    }

    resolve(response);
  });
}

function handleSmile(brokenDownText, sessionId, canEdit) {
  return new Promise(async (resolve) => {
    let textlength = brokenDownText.length;
    let response = "";
    let { QS_update_data_stage: ussdStage } = await redisClient.hgetallAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`
    );
    if (textlength === 8 && canEdit) {
      let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (selectedBundle <= 6 && selectedBundle >= 1) {
        await saveUserBundleData(sessionId, selectedBundle - 1, "Smile");
        response = await generateSummary(sessionId);
      } else if (selectedBundle === 7) {
        response = "CON Update Bundle:\n";
        let bundles = await displayBundles("Smile", 6, 11);
        response += bundles;
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else if (textlength === 9 && canEdit) {
      let userResponse = brokenDownText[textlength - 1];
      let selectedBundle = Number(brokenDownText[textlength - 1]);

      if (ussdStage === "Picked bundle") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await updateBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      } else {
        if (selectedBundle <= 6 && selectedBundle >= 1) {
          await saveUserBundleData(sessionId, selectedBundle + 5, "Smile");
          response = await generateSummary(sessionId);
        } else if (selectedBundle === 7) {
          response = "CON Update Bundle:\n";
          let bundles = await displayBundles("Smile", 12, 17);
          response += bundles;
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      }
    } else if (
      (textlength === 10 ||
        textlength === 11 ||
        textlength === 12 ||
        textlength === 13 ||
        textlength === 14 ||
        textlength === 15 ||
        textlength === 16 ||
        textlength === 17 ||
        textlength === 18 ||
        textlength === 19 ||
        textlength === 20 ||
        textlength === 21 ||
        textlength === 22 ||
        textlength === 23 ||
        textlength === 24 ||
        textlength === 25) &&
      canEdit
    ) {
      let userResponse = brokenDownText[textlength - 1];
      let selectedBundle = Number(brokenDownText[textlength - 1]);

      let addBy = 0;
      let dispayStart = 0;
      let dispayEnd = 0;

      switch (textlength) {
        case 10:
          addBy = 11;
          dispayStart = 18;
          dispayEnd = 23;
          break;
        case 11:
          addBy = 17;
          dispayStart = 24;
          dispayEnd = 29;
          break;
        case 12:
          addBy = 23;
          dispayStart = 30;
          dispayEnd = 35;
          break;
        case 13:
          addBy = 29;
          dispayStart = 36;
          dispayEnd = 41;
          break;
        case 14:
          addBy = 35;
          dispayStart = 42;
          dispayEnd = 47;
          break;
        case 15:
          addBy = 41;
          dispayStart = 48;
          dispayEnd = 53;
          break;
        case 16:
          addBy = 47;
          dispayStart = 54;
          dispayEnd = 59;
          break;
        case 17:
          addBy = 53;
          dispayStart = 60;
          dispayEnd = 65;
          break;
        case 18:
          addBy = 59;
          dispayStart = 66;
          dispayEnd = 71;
          break;
        case 19:
          addBy = 65;
          dispayStart = 72;
          dispayEnd = 77;
          break;
        case 20:
          addBy = 71;
          dispayStart = 78;
          dispayEnd = 83;
          break;
        case 21:
          addBy = 77;
          dispayStart = 84;
          dispayEnd = 89;
          break;
        case 22:
          addBy = 83;
          dispayStart = 90;
          dispayEnd = 95;
          break;
        case 23:
          addBy = 89;
          dispayStart = 96;
          dispayEnd = 101;
          break;
        case 24:
          addBy = 95;
          dispayStart = 102;
          dispayEnd = 107;
          break;
        case 25:
          addBy = 101;
          dispayStart = 108;
          dispayEnd = -1;
          break;
      }

      if (ussdStage === "Picked bundle") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await updateBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      } else {
        if (selectedBundle <= 6 && selectedBundle >= 1) {
          await saveUserBundleData(sessionId, selectedBundle + addBy, "Smile");
          response = await generateSummary(sessionId);
        } else if (selectedBundle === 7) {
          response = "CON Update Bundle:\n";
          let bundles = await displayBundles("Smile", dispayStart, dispayEnd);
          response += bundles;
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      }
    } else if (textlength === 26 && canEdit) {
      let userResponse = brokenDownText[textlength - 1];
      let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (ussdStage === "Picked bundle") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await updateBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      } else {
        if (selectedBundle <= 4 && selectedBundle >= 1) {
          await saveUserBundleData(sessionId, selectedBundle + 107, "Smile");
          response = await generateSummary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      }
    } else if (textlength === 27 && canEdit) {
      let userResponse = brokenDownText[textlength - 1];
      // let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (ussdStage === "Picked bundle") {
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
    } else {
      response = "CON Error! Wrong option inputed\n\n0 Menu";
    }

    resolve(response);
  });
}

function handleMTN(brokenDownText, sessionId, canEdit) {
  return new Promise(async (resolve) => {
    let textlength = brokenDownText.length;
    let response = "";
    let { QS_update_data_stage: ussdStage } = await redisClient.hgetallAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`
    );
    if (textlength === 8 && canEdit) {
      let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (selectedBundle <= 7 && selectedBundle >= 1) {
        await saveUserBundleData(sessionId, selectedBundle - 1, "MTN");
        response = await generateSummary(sessionId);
      } else if (selectedBundle === 8) {
        response = "CON Update Bundle:\n";
        let bundles = await displayBundles("MTN", 7, 13);
        response += bundles;
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else if (textlength === 9 && canEdit) {
      let userResponse = brokenDownText[textlength - 1];
      let selectedBundle = Number(brokenDownText[textlength - 1]);

      if (ussdStage === "Picked bundle") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await updateBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      } else {
        if (selectedBundle <= 7 && selectedBundle >= 1) {
          await saveUserBundleData(sessionId, selectedBundle + 6, "MTN");
          response = await generateSummary(sessionId);
        } else if (selectedBundle === 8) {
          response = "CON Update Bundle:\n";
          let bundles = await displayBundles("MTN", 14, 20);
          response += bundles;
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      }
    } else if (textlength === 10 && canEdit) {
      let userResponse = brokenDownText[textlength - 1];
      let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (ussdStage === "Picked bundle") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await updateBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      } else {
        if (selectedBundle <= 7 && selectedBundle >= 1) {
          await saveUserBundleData(sessionId, selectedBundle + 13, "MTN");
          response = await generateSummary(sessionId);
        } else if (selectedBundle === 8) {
          response = "CON Update Bundle:\n";
          let bundles = await displayBundles("MTN", 21, -1);
          response += bundles;
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      }
    } else if (textlength === 11 && canEdit) {
      let userResponse = brokenDownText[textlength - 1];
      let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (ussdStage === "Picked bundle") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await updateBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      } else {
        if (selectedBundle <= 7 && selectedBundle >= 1) {
          await saveUserBundleData(sessionId, selectedBundle + 20, "MTN");
          response = await generateSummary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      }
    } else if (textlength === 12 && canEdit) {
      let userResponse = brokenDownText[textlength - 1];
      //   let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (ussdStage === "Picked bundle") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await updateBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      }
    } else {
      response = "CON Error! Wrong option inputed\n\n0 Menu";
    }

    resolve(response);
  });
}

function handleAirtel(brokenDownText, sessionId, canEdit) {
  return new Promise(async (resolve) => {
    let textlength = brokenDownText.length;
    let response = "";
    let { QS_update_data_stage: ussdStage } = await redisClient.hgetallAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`
    );
    if (textlength === 8 && canEdit) {
      let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (selectedBundle <= 8 && selectedBundle >= 1) {
        await saveUserBundleData(sessionId, selectedBundle - 1, "Airtel");
        response = await generateSummary(sessionId);
      } else if (selectedBundle === 9) {
        response = "CON Update Bundle:\n";
        let bundles = await displayBundles("Airtel", 8, -1);
        response += bundles;
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else if (textlength === 9 && canEdit) {
      let userResponse = brokenDownText[textlength - 1];
      let selectedBundle = Number(brokenDownText[textlength - 1]);

      if (ussdStage === "Picked bundle") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await updateBeneficiary(sessionId);
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
    } else if (textlength === 10 && canEdit) {
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

function handleEtisalat(brokenDownText, sessionId, canEdit) {
  return new Promise(async (resolve) => {
    let textlength = brokenDownText.length;
    let response = "";
    let { QS_update_data_stage: ussdStage } = await redisClient.hgetallAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`
    );
    if (textlength === 8 && canEdit) {
      let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (selectedBundle <= 8 && selectedBundle >= 1) {
        await saveUserBundleData(sessionId, selectedBundle - 1, "Etisalat");
        response = await generateSummary(sessionId);
      } else if (selectedBundle === 9) {
        response = "CON Update Bundle:\n";
        let bundles = await displayBundles("Etisalat", 8, -1);
        response += bundles;
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else if (textlength === 9 && canEdit) {
      let userResponse = brokenDownText[textlength - 1];
      let selectedBundle = Number(brokenDownText[textlength - 1]);

      if (ussdStage === "Picked bundle") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await updateBeneficiary(sessionId);
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
    } else if (textlength === 10 && canEdit) {
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

function handleSpectranet(brokenDownText, sessionId, canEdit) {
  return new Promise(async (resolve) => {
    let textlength = brokenDownText.length;
    let response = "";
    if (textlength === 8 && canEdit) {
      let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (selectedBundle <= 6 && selectedBundle >= 1) {
        await saveUserBundleData(sessionId, selectedBundle - 1, "Spectranet");
        response = await generateSummary(sessionId);
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else if (textlength === 9 && canEdit) {
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

function updateBeneficiary(sessionId) {
  return new Promise(async (resolve) => {
    let response = "";
    let {
      mongo_userId,
      QS_update_data_name,
      QS_update_data_networkName,
      QS_update_data_networkCode,
      QS_update_data_phoneNumber,
      QS_update_data_bundleName,
      QS_update_data_bundleCode,
      QS_update_data_bundlePrice,
      QS_update_databundle_profileID,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
    let dataDoc = {
      name: QS_update_data_name,
      networkName: QS_update_data_networkName,
      networkCode: QS_update_data_networkCode,
      phoneNumber: QS_update_data_phoneNumber,
      defaultBundleName: QS_update_data_bundleName,
      defaultBundleCode: QS_update_data_bundleCode,
      defaultBundlePrice: QS_update_data_bundlePrice,
      customer: mongo_userId,
      updatedAt: Date.now(),
    };
    let updated = await mongoFront.updateProfile(
      QS_update_databundle_profileID,
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
      let [chosenBundleName] = await redisClient.lrangeAsync(
        `${APP_PREFIX_REDIS}:${codeName}BundleNames`,
        chosenBundle,
        chosenBundle
      );

      let [chosenBundleCode] = await redisClient.lrangeAsync(
        `${APP_PREFIX_REDIS}:${codeName}BundleCodes`,
        chosenBundle,
        chosenBundle
      );

      let [dataPrice] = await redisClient.lrangeAsync(
        `${APP_PREFIX_REDIS}:${codeName}BundlePrices`,
        chosenBundle,
        chosenBundle
      );

      await redisClient.hmset(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "QS_update_data_bundleName",
        chosenBundleName,
        "QS_update_data_bundleCode",
        chosenBundleCode,
        "QS_update_data_bundlePrice",
        dataPrice,
        "QS_update_data_stage",
        "Picked bundle"
      );

      console.log(chosenBundleCode, chosenBundleName, dataPrice);
      resolve();
    } else {
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
        "QS_update_data_bundleName",
        chosenBundleName,
        "QS_update_data_bundleCode",
        chosenBundleCode,
        "QS_update_data_bundlePrice",
        dataPrice,
        "QS_update_data_stage",
        "Picked bundle"
      );

      console.log(chosenBundleCode, chosenBundleName, dataPrice);

      resolve();
    }
  });
}

function generateSummary(sessionId) {
  return new Promise(async (resolve) => {
    let {
      QS_update_data_name,
      QS_update_data_networkName,
      QS_update_data_phoneNumber,
      QS_update_data_bundleName,
      QS_update_data_bundlePrice,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
    let response = "";
    let refinedName = "";
    if (QS_update_data_networkName.includes("9mobile")) {
      refinedName = "9mobile";
    }

    response = `CON Confirm beneficiary:\nName: ${QS_update_data_name}\nNetwork: ${
      refinedName === "" ? QS_update_data_networkName : refinedName
    }\nPhoneNumber: ${QS_update_data_phoneNumber}\nBundle: ${QS_update_data_bundleName}\nPrice: ${formatNumber(
      QS_update_data_bundlePrice
    )}\n\n1 Confirm\n2 Cancel`;

    resolve(response);
  });
}

function viewProfile(mongo_userId, profileName, sessionId) {
  return new Promise(async (resolve) => {
    let profile = await mongoFront.findExistingProfile(
      mongo_userId,
      profileName,
      "databundle"
    );
    if (profile) {
      let { name, _id } = profile;
      await redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "QS_update_data_oldname",
        name,
        "QS_update_databundle_profileID",
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
    let profiles = await mongoFront.getTopProfiles(mongo_userId, "databundle");
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

module.exports = { updateDatabundleProfile };
