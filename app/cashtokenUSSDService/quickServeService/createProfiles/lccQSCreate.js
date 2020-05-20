const { redisClient } = require("$config/redisConnectConfig");
const { verifyLCCAccountNo } = require("$felaLibs");
const mongoFront = require("$mongoLibs/mongoFront");
const { APP_PREFIX_REDIS, formatNumber } = require("$utils");

function createLccProfile(text, phoneNumber, sessionId) {
  return new Promise(async (resolve) => {
    let brokenDownText = text.split("*");
    let response = "";
    let textlength = brokenDownText.length;

    if (textlength === 3) {
      response = "CON Enter Beneficiary's Name (Max 20 characters):";
    } else if (textlength === 4) {
      let profileName = brokenDownText[textlength - 1];
      if (profileName.length >= 1 && profileName.length <= 20) {
        redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_Lcc_name",
          profileName.toLowerCase()
        );

        response = "CON Enter Beneficiary's LCC Account Number:";
      } else {
        console.log("Beneficiary's Name inputed is more than 20 characters");
        if (profileName.length < 1) {
          response = "CON Error! Name field cannot be empty\n\n0 Main Menu";
        } else {
          response =
            "CON Error! Beneficiary's name can only be 20 characters long or less\n\n0 Main Menu";
        }
      }
    } else if (textlength === 5) {
      let lccAccountNo = brokenDownText[textlength - 1];
      let confirmLccAccountNo = await verifyLCCAccountNo(lccAccountNo);

      if (confirmLccAccountNo) {
        redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_Lcc_accountNo",
          lccAccountNo
        );
        response = `CON Enter Default Amount to Purchase for this Beneficiary:`;
      } else {
        response =
          "CON Error! LCC acount number cannot be verified\n\n0 Main Menu";
      }
    } else if (textlength === 6) {
      let inputedAmount = brokenDownText[textlength - 1];
      if (/^[0-9]*$/.test(inputedAmount)) {
        if (Number(inputedAmount) >= 50 && Number(inputedAmount) <= 100000) {
          await redisClient.hmsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "QS_Lcc_amount",
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
    } else if (textlength === 7 && brokenDownText[textlength - 1] == "1") {
      console.log("Saving lcc beneficiary");
      let {
        mongo_userId,
        QS_Lcc_amount,
        QS_Lcc_accountNo,
        QS_Lcc_name,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

      let beneficiaryExists = await mongoFront.findExistingProfile(
        mongo_userId,
        QS_Lcc_name,
        "lcc"
      );

      if (!beneficiaryExists) {
        console.log("Creating a new LCC beneficiary");
        let lccDoc = {
          name: QS_Lcc_name,
          accountNumber: QS_Lcc_accountNo,
          defaultAmount: QS_Lcc_amount,
          customer: mongo_userId,
        };
        let newId = await mongoFront.createProfile(lccDoc, "lcc");
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
          "QS_Lcc_oldProfileId",
          beneficiaryExists._id.toString()
        );
        response = `CON You currently have a beneficiary with the name '${QS_Lcc_name}'. Will you like to update this beneficiary instead?\n\n1 Yes\n2 No`;
      }
    } else if (textlength === 7 && brokenDownText[textlength - 1] == "2") {
      response = "CON Beneficiary creation process canceled by user\n\n0 Menu";
    } else if (textlength === 8 && brokenDownText[textlength - 1] == "1") {
      let {
        mongo_userId,
        QS_Lcc_amount,
        QS_Lcc_accountNo,
        QS_Lcc_name,
        QS_Lcc_oldProfileId,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      let lccDoc = {
        name: QS_Lcc_name,
        accountNumber: QS_Lcc_accountNo,
        defaultAmount: QS_Lcc_amount,
        customer: mongo_userId,
        updatedAt: Date.now(),
      };
      let updated = await mongoFront.updateProfile(
        QS_Lcc_oldProfileId,
        lccDoc,
        "lcc"
      );
      if (!!updated) {
        response = "CON Beneficiary updated successfully!\n\n0 Menu";
      } else {
        response =
          "CON There was an error saving beneficiary.\nPlease try again later\n\n0 Menu";
      }
    } else if (textlength === 8 && brokenDownText[textlength - 1] == "2") {
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
      QS_Lcc_amount,
      QS_Lcc_accountNo,
      QS_Lcc_name,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
    let response = "";

    response = `CON Confirm your LCC beneficiary:\nName: ${QS_Lcc_name}\nAccountNo: ${QS_Lcc_accountNo}\nDefaultAmount: ${formatNumber(
      QS_Lcc_amount
    )}\n\n1 Confirm\n2 Cancel`;

    resolve(response);
  });
}

module.exports = { createLccProfile };
