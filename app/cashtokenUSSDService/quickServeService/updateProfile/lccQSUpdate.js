const { redisClient } = require("$config/redisConnectConfig");
const { verifyLCCAccountNo } = require("$felaLibs");
const mongoFront = require("$mongoLibs/mongoFront");
const { APP_PREFIX_REDIS, formatNumber } = require("$utils");

function updateLccProfile(text, phoneNumber, sessionId) {
  return new Promise(async (resolve) => {
    let brokenDownText = text.split("*");
    let response = "";
    let textlength = brokenDownText.length;
    let {
      mongo_userId,
      QS_update_lcc_oldname: profileOldName,
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
            QS_update_lcc_oldname: oldName,
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
          "QS_update_lcc_name",
          profileName.toLowerCase()
        );

        response = "CON Update Beneficiary's LCC Account Number:";
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
      let lccAccountNo = brokenDownText[textlength - 1];
      let confirmLccAccountNo = await verifyLCCAccountNo(lccAccountNo);

      if (confirmLccAccountNo) {
        redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_update_lcc_accountNo",
          lccAccountNo
        );
        response = `CON Update Default Amount to Purchase for this Beneficiary:`;
      } else {
        response = "CON Error! LCC acount number cannot be verified\n\n0 Menu";
      }
    } else if (textlength === 7 && canEdit) {
      let inputedAmount = brokenDownText[textlength - 1];
      if (/^[0-9]*$/.test(inputedAmount)) {
        if (Number(inputedAmount) >= 50 && Number(inputedAmount) <= 100000) {
          await redisClient.hmsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "QS_update_lcc_amount",
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
      textlength === 8 &&
      brokenDownText[textlength - 1] == "1" &&
      canEdit
    ) {
      let {
        mongo_userId,
        QS_update_lcc_amount,
        QS_update_lcc_accountNo,
        QS_update_lcc_name,
        QS_update_lcc_profileID,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      let lccDoc = {
        name: QS_update_lcc_name,
        accountNumber: QS_update_lcc_accountNo,
        defaultAmount: QS_update_lcc_amount,
        customer: mongo_userId,
        updatedAt: Date.now(),
      };
      let updated = await mongoFront.updateProfile(
        QS_update_lcc_profileID,
        lccDoc,
        "lcc"
      );
      if (!!updated) {
        response = "END Beneficiary updated successfully!";
      } else {
        response =
          "END There was an error saving beneficiary.\nPlease try again later";
      }
    } else if (
      textlength === 8 &&
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
      "lcc"
    );
    if (profile) {
      let { name, _id } = profile;
      await redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "QS_update_lcc_oldname",
        name,
        "QS_update_lcc_profileID",
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
    let profiles = await mongoFront.getTopProfiles(mongo_userId, "lcc");
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

function generateSummary(sessionId) {
  return new Promise(async (resolve) => {
    let {
      QS_update_lcc_amount,
      QS_update_lcc_accountNo,
      QS_update_lcc_name,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
    let response = "";

    response = `CON Confirm your LCC beneficiary:\nName: ${QS_update_lcc_name}\nAccountNo: ${QS_update_lcc_accountNo}\nDefaultAmount: ${formatNumber(
      QS_update_lcc_amount
    )}\n\n1 Confirm\n2 Cancel`;

    resolve(response);
  });
}

module.exports = { updateLccProfile };
