const { redisClient } = require("$config/redisConnectConfig");
const { getAirtimeProviders } = require("$felaLibs");
const mongoFront = require("$mongoLibs/mongoFront");
const {
  APP_PREFIX_REDIS,
  testPhoneNumber,
  sanitizePhoneNumber,
  formatNumber,
} = require("$utils");

function updateAirtimeProfile(text, phoneNumber, sessionId) {
  return new Promise(async (resolve) => {
    let brokenDownText = text.split("*");
    let response = "";
    let textlength = brokenDownText.length;
    let {
      mongo_userId,
      QS_update_airtime_oldname: profileOldName,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
    let canEdit = !!profileOldName ? true : false;

    let { providersName, providersCode } = await getAirtimeProviders();

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
            QS_update_airtime_oldname: oldName,
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
        await redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_update_airtime_name",
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
    } else if (
      textlength === 6 &&
      brokenDownText[textlength - 1] <= providersName.length &&
      canEdit
    ) {
      let selectedNetwork = brokenDownText[textlength - 1] - 1;
      redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "QS_update_airtime_networkName",
        providersName[selectedNetwork],
        "QS_update_airtime_networkCode",
        providersCode[selectedNetwork]
      );
      response = `CON Update Beneficiary's Phone Number:`;
    } else if (textlength === 7 && canEdit) {
      let inputedBeneficiarysNo = brokenDownText[textlength - 1];
      if (testPhoneNumber(inputedBeneficiarysNo)) {
        redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_update_airtime_phoneNumber",
          sanitizePhoneNumber(inputedBeneficiarysNo)
        );
        response =
          "CON Update Default Amount to Purchase for this Beneficiary:";
      } else {
        response = "CON Error! Inputed phone number is not valid\n\n0 Menu";
      }
    } else if (textlength === 8 && canEdit) {
      let inputedAmount = brokenDownText[textlength - 1];
      if (/^[0-9]*$/.test(inputedAmount)) {
        if (Number(inputedAmount) >= 50 && Number(inputedAmount) <= 100000) {
          await redisClient.hmsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "QS_update_airtime_amount",
            inputedAmount
          );
          response = await generateSummary(sessionId);
        } else {
          response =
            "CON Error! Amount must be between 50 naira and 100,000 naira\n\n0 Menu";
        }
      } else {
        response = "CON Error! Inputed amount is not a valid number\n\n0 Menu";
      }
    } else if (
      textlength === 9 &&
      brokenDownText[textlength - 1] == "1" &&
      canEdit
    ) {
      let {
        mongo_userId,
        QS_update_airtime_name,
        QS_update_airtime_amount,
        QS_update_airtime_phoneNumber,
        QS_update_airtime_networkCode,
        QS_update_airtime_networkName,
        QS_update_airtime_profileID,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      let airtimeDoc = {
        name: QS_update_airtime_name,
        networkCode: QS_update_airtime_networkCode,
        networkName: QS_update_airtime_networkName,
        phoneNumber: QS_update_airtime_phoneNumber,
        defaultAmount: QS_update_airtime_amount,
        customer: mongo_userId,
        updatedAt: Date.now(),
      };
      let updated = await mongoFront.updateProfile(
        QS_update_airtime_profileID,
        airtimeDoc,
        "airtime"
      );
      if (!!updated) {
        response = "END Beneficiary updated successfully!";
      } else {
        response =
          "END There was an error saving beneficiary.\nPlease try again later";
      }
    } else if (
      textlength === 9 &&
      brokenDownText[textlength - 1] == "2" &&
      canEdit
    ) {
      response = "END Beneficiary creation process canceled by user";
    } else {
      response = "CON Error! Wrong option inputed\n\n0 Menu";
    }

    resolve(response);
  });
}

function viewProfile(mongo_userId, profileName, sessionId) {
  return new Promise(async (resolve) => {
    let profile = await mongoFront.findExistingProfile(
      mongo_userId,
      profileName,
      "airtime"
    );

    if (profile) {
      let { name, _id } = profile;
      await redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "QS_update_airtime_oldname",
        name,
        "QS_update_airtime_profileID",
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
    let profiles = await mongoFront.getTopProfiles(mongo_userId, "airtime");
    if (profiles.length === 0) {
      response = `CON You do not have any top beneficiaries yet. Create some beneficiaries to see them here\n\n0 Menu`;
    } else {
      response = `CON Below are some of your top beneficiaries:\n`;
      for (let profile of profiles) {
        response += `- ${profile}\n`;
      }
      response += `Enter the name of a beneficiary to update:`;
    }

    resolve(response);
  });
}

function generateSummary(sessionId) {
  return new Promise(async (resolve) => {
    let {
      QS_update_airtime_amount,
      QS_update_airtime_phoneNumber,
      QS_update_airtime_networkName,
      QS_update_airtime_name,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
    let response = "";

    response = `CON Confirm your airtime beneficiary:\nName: ${QS_update_airtime_name}\nNetwork: ${QS_update_airtime_networkName}\nPhoneNumber: ${QS_update_airtime_phoneNumber}\nDefaultAmount: ${formatNumber(
      QS_update_airtime_amount
    )}\n\n1 Confirm\n2 Cancel`;

    resolve(response);
  });
}

module.exports = { updateAirtimeProfile };
