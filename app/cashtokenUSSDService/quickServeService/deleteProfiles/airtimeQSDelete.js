const { redisClient } = require("$config/redisConnectConfig");
const mongoFront = require("$mongoLibs/mongoFront");
const { APP_PREFIX_REDIS, formatNumber } = require("$utils");

function deleteAirtimeProfile(text, phoneNumber, sessionId) {
  return new Promise(async (resolve) => {
    let brokenDownText = text.split("*");
    let response = "";
    let textlength = brokenDownText.length;
    let { mongo_userId } = await redisClient.hgetallAsync(
      `${APP_PREFIX_REDIS}:${sessionId}`
    );

    if (textlength === 3) {
      response = await listTopProfiles(mongo_userId);
    } else if (textlength === 4) {
      let profileName = brokenDownText[textlength - 1];
      if (profileName.length > 20 || profileName.length <= 0) {
        response = `CON Inputed beneficiary name is invalid\n\n0 Menu`;
      } else {
        response = await viewProfile(
          mongo_userId,
          profileName.toLowerCase(),
          sessionId
        );
      }
    } else if (textlength === 5) {
      let {
        mongo_userId,
        QS_delete_airtime_name: cachedName,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      let inputedName = brokenDownText[textlength - 1];
      if (inputedName.toLowerCase() === cachedName) {
        response = await deleteProfile(mongo_userId, cachedName);
      } else {
        response =
          "CON Error! Wrong name inputed\nBeneficiary could not be deleted\n\n0 Menu";
      }
    } else {
      response = "CON Error! Wrong option inputed\n\n0 Menu";
    }

    resolve(response);
  });
}

function deleteProfile(mongo_userId, profileName) {
  return new Promise(async (resolve) => {
    let response = "";
    let deleteStatus = await mongoFront.deleteProfile(
      mongo_userId,
      profileName,
      "airtime"
    );

    if (deleteStatus) {
      response = `CON Beneficiary "${profileName}" was deleted successfully\n\n0 Menu`;
    } else {
      response = `CON Beneficiary could not be deleted.\nPlease try again\n\n0 Menu`;
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
      "airtime"
    );
    if (profile) {
      let {
        name,
        networkName,
        phoneNumber,
        defaultAmount,
        successfulTransactions = 0,
      } = profile;
      await redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "QS_delete_airtime_name",
        name
      );
      let refinedNetwork = networkName.includes("Etisalat")
        ? "9mobile"
        : networkName;

      response = `CON Name: ${name}\nNetwork: ${refinedNetwork}\nPhoneNo: ${phoneNumber}\nDefaultAmount: ${formatNumber(
        defaultAmount
      )}\nTimesUsed: ${formatNumber(
        successfulTransactions
      )}\n\n0 Cancel\nEnter name to confirm delete:`;
    } else {
      response = `CON The beneficiary "${profileName}" does not exist\n\n0 Menu`;
    }

    resolve(response);
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
      response += `Enter the name of a beneficiary to view:`;
    }

    resolve(response);
  });
}

module.exports = { deleteAirtimeProfile };
