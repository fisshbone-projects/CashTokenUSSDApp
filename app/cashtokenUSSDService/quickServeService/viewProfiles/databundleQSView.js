const { redisClient } = require("$config/redisConnectConfig");
const mongoFront = require("$mongoLibs/mongoFront");
const { APP_PREFIX_REDIS, formatNumber } = require("$utils");

function viewDatabundleProfile(text, phoneNumber, sessionId) {
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
        response = await viewProfile(mongo_userId, profileName.toLowerCase());
      }
    } else {
      response = "CON Error! Wrong option inputed\n\n0 Menu";
    }

    resolve(response);
  });
}

function viewProfile(mongo_userId, profileName) {
  return new Promise(async (resolve) => {
    let response = "";
    let profile = await mongoFront.findExistingProfile(
      mongo_userId,
      profileName,
      "databundle"
    );
    if (profile) {
      let {
        name,
        networkName,
        phoneNumber,
        defaultBundleName,
        defaultBundlePrice,
        successfulTransactions = 0,
      } = profile;
      response = `CON Beneficiary's Details:\nName: ${name}\nNetwork: ${networkName}\nPhoneNo: ${phoneNumber}\nBundle: ${defaultBundleName}\nPrice: ${formatNumber(
        defaultBundlePrice
      )}\nTimesUsed: ${formatNumber(successfulTransactions)}\n\n0 Menu`;
    } else {
      response = `CON The beneficiary "${profileName}" does not exist\n\n0 Menu`;
    }

    resolve(response);
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
      response += `Type the name of a beneficiary to view:`;
    }

    resolve(response);
  });
}

module.exports = { viewDatabundleProfile };
