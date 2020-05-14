const { redisClient } = require("../../../../config/redisConnectConfig");
const { getAirtimeProviders } = require("../../../libs/felaLibs");
const mongoFront = require("../../../libs/mongoLibs/mongoFront");
const {
  APP_PREFIX_REDIS,
  testPhoneNumber,
  sanitizePhoneNumber,
  formatNumber,
} = require("../../../utils");

function createAirtimeProfile(text, phoneNumber, sessionId) {
  return new Promise(async (resolve) => {
    let brokenDownText = text.split("*");
    let response = "";
    let textlength = brokenDownText.length;

    let { providersName, providersCode } = await getAirtimeProviders();

    if (textlength === 3) {
      response = "CON Enter Beneficiary's Name (Max 20 characters):";
    } else if (textlength === 4) {
      let profileName = brokenDownText[textlength - 1];
      if (profileName.length >= 1 && profileName.length <= 20) {
        redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_Airtime_name",
          profileName.toLowerCase()
        );

        response = "CON Select Beneficiary's Network:\n";
        providersName.forEach((provider, index) => {
          response += `${++index} ${provider}\n`;
        });
      } else {
        console.log("Beneficiary's Name inputed is more than 20 characters");
        if (profileName.length < 1) {
          response = "CON Error! Name field cannot be empty\n\n0 Main Menu";
        } else {
          response =
            "CON Error! Beneficiary's name can only be 20 characters long or less\n\n0 Main Menu";
        }
      }
    } else if (
      textlength === 5 &&
      brokenDownText[textlength - 1] <= providersName.length
    ) {
      let selectedNetwork = brokenDownText[textlength - 1] - 1;
      redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "QS_Airtime_networkName",
        providersName[selectedNetwork],
        "QS_Airtime_networkCode",
        providersCode[selectedNetwork]
      );
      response = `CON Enter Beneficiary's Phone Number:`;
    } else if (textlength === 6) {
      let inputedBeneficiarysNo = brokenDownText[textlength - 1];
      if (testPhoneNumber(inputedBeneficiarysNo)) {
        redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_Airtime_phoneNumber",
          sanitizePhoneNumber(inputedBeneficiarysNo)
        );
        response = "CON Enter Default Amount to Purchase for this Beneficiary:";
      }
    } else if (textlength === 7) {
      let inputedAmount = brokenDownText[textlength - 1];
      if (/^[0-9]*$/.test(inputedAmount)) {
        if (Number(inputedAmount) >= 50 && Number(inputedAmount) <= 100000) {
          await redisClient.hmsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "QS_Airtime_amount",
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
    } else if (textlength === 8 && brokenDownText[textlength - 1] == "1") {
      console.log("Saving airtime beneficiary");
      let {
        mongo_userId,
        QS_Airtime_name,
        QS_Airtime_amount,
        QS_Airtime_phoneNumber,
        QS_Airtime_networkCode,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

      let beneficiaryExists = await mongoFront.findExistingAirtimeProfile(
        mongo_userId,
        QS_Airtime_name
      );

      if (!beneficiaryExists) {
        console.log("Creating a new Airtime beneficiary");
        let airtimeDoc = {
          name: QS_Airtime_name,
          network: QS_Airtime_networkCode,
          phoneNumber: QS_Airtime_phoneNumber,
          defaultAmount: QS_Airtime_amount,
          customer: mongo_userId,
        };
        let newId = await mongoFront.createAirtimeProfile(airtimeDoc);
        if (newId) {
          response = "CON Beneficiary created successfully!\n\n0 Menu";
        } else {
          response =
            "CON There was an error saving beneficiary.\nPlease try again later\n\n0 Menu";
        }
      } else {
        console.log("Updating beneficiary from create state");
        await redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_Airtime_oldProfileId",
          beneficiaryExists._id.toString()
        );
        response = `CON You currently have a beneficiary with the name '${QS_Airtime_name}'. Will you like to update this beneficiary instead?\n\n1 Yes\n2 No`;
      }
    } else if (textlength === 8 && brokenDownText[textlength - 1] == "2") {
      response = "CON Beneficiary creation process canceled by user\n\n0 Menu";
    } else if (textlength === 9 && brokenDownText[textlength - 1] == "1") {
      let {
        mongo_userId,
        QS_Airtime_name,
        QS_Airtime_amount,
        QS_Airtime_phoneNumber,
        QS_Airtime_networkCode,
        QS_Airtime_oldProfileId,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      let airtimeDoc = {
        name: QS_Airtime_name,
        network: QS_Airtime_networkCode,
        phoneNumber: QS_Airtime_phoneNumber,
        defaultAmount: QS_Airtime_amount,
        customer: mongo_userId,
        updatedAt: Date.now(),
      };
      let updated = await mongoFront.updateAirtimeProfile(
        QS_Airtime_oldProfileId,
        airtimeDoc
      );
      if (!!updated) {
        response = "CON Beneficiary updated successfully!\n\n0 Menu";
      } else {
        response =
          "CON There was an error saving beneficiary.\nPlease try again later\n\n0 Menu";
      }
    } else if (textlength === 9 && brokenDownText[textlength - 1] == "2") {
      response = "CON Beneficiary creation process canceled by user\n\n0 Menu";
    } else {
      response = "CON Error! Wrong option inputed\n\n0 Main Menu";
    }

    resolve(response);
  });
}

function generateSummary(sessionId) {
  return new Promise(async (resolve) => {
    let {
      QS_Airtime_amount,
      QS_Airtime_phoneNumber,
      QS_Airtime_networkName,
      QS_Airtime_name,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
    let response = "";

    response = `CON Confirm your airtime beneficiary:\nName: ${QS_Airtime_name}\nNetwork: ${QS_Airtime_networkName}\nPhoneNumber: ${QS_Airtime_phoneNumber}\nDefaultAmount: ${formatNumber(
      QS_Airtime_amount
    )}\n\n1 Confirm\n2 Cancel`;

    resolve(response);
  });
}

module.exports = { createAirtimeProfile };
