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
    } else if (textlength === 5) {
      if (Number(brokenDownText[textlength - 1]) <= providersName.length) {
        let selectedNetwork = brokenDownText[textlength - 1] - 1;
        redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_Data_networkName",
          providersName[selectedNetwork],
          "QS_Data_networkCode",
          providersCode[selectedNetwork]
        );
        response = `CON Enter Beneficiary's Phone Number:`;
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else if (textlength === 6) {
      let inputedBeneficiarysNo = brokenDownText[textlength - 1];
      let bundles = "";
      let { QS_Data_networkCode: networkCode } = await redisClient.hgetallAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`
      );
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
          "QS_Data_phoneNumber",
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

function handleSmile(brokenDownText, sessionId) {
  return new Promise(async (resolve) => {
    let textlength = brokenDownText.length;
    let response = "";
    let { QS_Data_stage: ussdStage } = await redisClient.hgetallAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`
    );
    if (textlength === 7) {
      let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (selectedBundle <= 6 && selectedBundle >= 1) {
        await saveUserBundleData(sessionId, selectedBundle - 1, "Smile");
        response = await generateSummary(sessionId);
      } else if (selectedBundle === 7) {
        response = "CON Select Bundle:\n";
        let bundles = await displayBundles("Smile", 6, 11);
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
        if (selectedBundle <= 6 && selectedBundle >= 1) {
          await saveUserBundleData(sessionId, selectedBundle + 5, "Smile");
          response = await generateSummary(sessionId);
        } else if (selectedBundle === 7) {
          response = "CON Select Bundle:\n";
          let bundles = await displayBundles("Smile", 12, 17);
          response += bundles;
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      }
    } else if (
      textlength === 9 ||
      textlength === 10 ||
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
      textlength === 24
    ) {
      let userResponse = brokenDownText[textlength - 1];
      let selectedBundle = Number(brokenDownText[textlength - 1]);

      let addBy = 0;
      let dispayStart = 0;
      let dispayEnd = 0;

      switch (textlength) {
        case 9:
          addBy = 11;
          dispayStart = 18;
          dispayEnd = 23;
          break;
        case 10:
          addBy = 17;
          dispayStart = 24;
          dispayEnd = 29;
          break;
        case 11:
          addBy = 23;
          dispayStart = 30;
          dispayEnd = 35;
          break;
        case 12:
          addBy = 29;
          dispayStart = 36;
          dispayEnd = 41;
          break;
        case 13:
          addBy = 35;
          dispayStart = 42;
          dispayEnd = 47;
          break;
        case 14:
          addBy = 41;
          dispayStart = 48;
          dispayEnd = 53;
          break;
        case 15:
          addBy = 47;
          dispayStart = 54;
          dispayEnd = 59;
          break;
        case 16:
          addBy = 53;
          dispayStart = 60;
          dispayEnd = 65;
          break;
        case 17:
          addBy = 59;
          dispayStart = 66;
          dispayEnd = 71;
          break;
        case 18:
          addBy = 65;
          dispayStart = 72;
          dispayEnd = 77;
          break;
        case 19:
          addBy = 71;
          dispayStart = 78;
          dispayEnd = 83;
          break;
        case 20:
          addBy = 77;
          dispayStart = 84;
          dispayEnd = 89;
          break;
        case 21:
          addBy = 83;
          dispayStart = 90;
          dispayEnd = 95;
          break;
        case 22:
          addBy = 89;
          dispayStart = 96;
          dispayEnd = 101;
          break;
        case 23:
          addBy = 95;
          dispayStart = 102;
          dispayEnd = 107;
          break;
        case 24:
          addBy = 101;
          dispayStart = 108;
          dispayEnd = -1;
          break;
      }

      if (ussdStage === "Updating Profile") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await updateBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      } else if (ussdStage === "Picked bundle") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await saveBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      } else {
        if (selectedBundle <= 6 && selectedBundle >= 1) {
          await saveUserBundleData(sessionId, selectedBundle + addBy, "Smile");
          response = await generateSummary(sessionId);
        } else if (selectedBundle === 7) {
          response = "CON Select Bundle:\n";
          let bundles = await displayBundles("Smile", dispayStart, dispayEnd);
          response += bundles;
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      }
    } else if (textlength === 25) {
      let userResponse = brokenDownText[textlength - 1];
      let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (ussdStage === "Updating Profile") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await updateBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      } else if (ussdStage === "Picked bundle") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await saveBeneficiary(sessionId);
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
    } else if (textlength === 26) {
      let userResponse = brokenDownText[textlength - 1];
      // let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (ussdStage === "Picked bundle") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await saveBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      } else if (ussdStage === "Updating Profile") {
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
    } else if (textlength === 27) {
      let userResponse = brokenDownText[textlength - 1];
      // let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (ussdStage === "Updating Profile") {
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

function handleMTN(brokenDownText, sessionId) {
  return new Promise(async (resolve) => {
    let textlength = brokenDownText.length;
    let response = "";
    let { QS_Data_stage: ussdStage } = await redisClient.hgetallAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`
    );
    if (textlength === 7) {
      let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (selectedBundle <= 7 && selectedBundle >= 1) {
        await saveUserBundleData(sessionId, selectedBundle - 1, "MTN");
        response = await generateSummary(sessionId);
      } else if (selectedBundle === 8) {
        response = "CON Select Bundle:\n";
        let bundles = await displayBundles("MTN", 7, 13);
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
        if (selectedBundle <= 7 && selectedBundle >= 1) {
          await saveUserBundleData(sessionId, selectedBundle + 6, "MTN");
          response = await generateSummary(sessionId);
        } else if (selectedBundle === 8) {
          response = "CON Select Bundle:\n";
          let bundles = await displayBundles("MTN", 14, 20);
          response += bundles;
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      }
    } else if (textlength === 9) {
      let userResponse = brokenDownText[textlength - 1];
      let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (ussdStage === "Updating Profile") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await updateBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      } else if (ussdStage === "Picked bundle") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await saveBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      } else {
        if (selectedBundle <= 7 && selectedBundle >= 1) {
          await saveUserBundleData(sessionId, selectedBundle + 13, "MTN");
          response = await generateSummary(sessionId);
        } else if (selectedBundle === 8) {
          response = "CON Select Bundle:\n";
          let bundles = await displayBundles("MTN", 21, -1);
          response += bundles;
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      }
    } else if (textlength === 10) {
      let userResponse = brokenDownText[textlength - 1];
      let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (ussdStage === "Updating Profile") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await updateBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      } else if (ussdStage === "Picked bundle") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await saveBeneficiary(sessionId);
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
    } else if (textlength === 11) {
      let userResponse = brokenDownText[textlength - 1];
      //   let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (ussdStage === "Updating Profile") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await updateBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      } else if (ussdStage === "Picked bundle") {
        if (userResponse === "2") {
          response = "END Beneficiary creation process canceled by user";
        } else if (userResponse === "1") {
          response = await saveBeneficiary(sessionId);
        } else {
          response = "CON Error! Wrong option inputed\n\n0 Menu";
        }
      }
    } else if (textlength === 12) {
      let userResponse = brokenDownText[textlength - 1];
      // let selectedBundle = Number(brokenDownText[textlength - 1]);
      if (ussdStage === "Updating Profile") {
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
    }
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
