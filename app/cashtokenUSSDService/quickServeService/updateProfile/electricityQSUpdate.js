const { redisClient } = require("$config/redisConnectConfig");
const { displayListOfDiscos, confirmMeterNo } = require("$felaLibs");
const mongoFront = require("$mongoLibs/mongoFront");
const { APP_PREFIX_REDIS, formatNumber } = require("$utils");

function updateElectricityProfile(text, phoneNumber, sessionId) {
  return new Promise(async (resolve) => {
    let brokenDownText = text.split("*");
    let response = "";
    let textlength = brokenDownText.length;
    let {
      mongo_userId,
      QS_update_elec_oldname: profileOldName,
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
            QS_update_elec_oldname: oldName,
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
          "QS_update_elec_name",
          profileName.toLowerCase()
        );

        response = "CON Update Beneficiary's Plan:\n1 Prepaid\n2 Postpaid";
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
      let selectedPlan = brokenDownText[textlength - 1];

      if (selectedPlan === "1") {
        redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_update_elec_plan",
          "prepaid"
        );

        response = `CON Update Disco:\n`;
        let discos = await displayListOfDiscos("prepaid");
        response += discos;
      } else if (selectedPlan === "2") {
        redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_update_elec_plan",
          "postpaid"
        );
        response = `CON Update Disco:\n`;
        let discos = await displayListOfDiscos("postpaid");
        response += discos;
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else if (textlength === 7 && canEdit) {
      let { QS_update_elec_plan: chosenPlan } = await redisClient.hgetallAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`
      );

      let chosenDisco = brokenDownText[textlength - 1];
      if (Number(chosenDisco) <= 9 && Number(chosenDisco) >= 1) {
        console.log(chosenPlan, chosenDisco);
        await saveDisco(chosenPlan, chosenDisco, sessionId);
        response = "CON Update Beneficiary's Meter Number:";
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else if (textlength === 8 && canEdit) {
      let meterNumber = brokenDownText[textlength - 1];
      let {
        QS_update_elec_plan: chosenPlan,
        QS_update_elec_disco: chosenDisco,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      let { verified, minimumAmount } = await confirmMeterNo(
        meterNumber,
        chosenPlan,
        chosenDisco
      );
      if (verified) {
        redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_update_elec_meterNo",
          meterNumber,
          "QS_update_elec_minAmount",
          minimumAmount
        );

        response =
          "CON Update Default Amount to Purchase for this Beneficiary:";
      } else {
        response =
          "CON Error!\nInputed meter number cannot be verified \n\n0 Menu";
      }
    } else if (textlength === 9 && canEdit) {
      let inputedAmount = brokenDownText[textlength - 1];
      let {
        QS_update_elec_minAmount: minimumAmount,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      if (/^[0-9]*$/.test(inputedAmount)) {
        if (
          Number(inputedAmount) >= minimumAmount &&
          Number(inputedAmount) <= 100000
        ) {
          await redisClient.hmsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "QS_update_elec_amount",
            inputedAmount
          );

          response = await generateSummary(sessionId);
        } else {
          response = `CON Error! Amount must be between ${formatNumber(
            minimumAmount
          )} naira and 100,000 naira\n\n0 Menu`;
        }
      } else {
        response = "CON Error! Inputed amount is not a valid number\n\n0 Menu";
      }
    } else if (textlength === 10 && canEdit) {
      let userResponse = brokenDownText[textlength - 1];
      if (userResponse === "2") {
        response = "END Beneficiary creation process canceled by user";
      } else if (userResponse === "1") {
        let {
          mongo_userId,
          QS_update_elec_name,
          QS_update_elec_plan,
          QS_update_elec_disco,
          QS_update_elec_meterNo,
          QS_update_elec_amount,
          QS_update_elec_profileID,
        } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
        let elecDoc = {
          name: QS_update_elec_name,
          plan: QS_update_elec_plan,
          disco: QS_update_elec_disco,
          meterNumber: QS_update_elec_meterNo,
          defaultAmount: QS_update_elec_amount,
          customer: mongo_userId,
          updatedAt: Date.now(),
        };
        let updated = await mongoFront.updateProfile(
          QS_update_elec_profileID,
          elecDoc,
          "electricity"
        );
        if (!!updated) {
          response = "END Beneficiary updated successfully!";
        } else {
          response =
            "END There was an error saving beneficiary.\nPlease try again later";
        }
      } else {
        response = "END Beneficiary creation process canceled by user";
      }
    } else {
      response = "CON Error! Wrong option inputed\n\n0 Menu";
    }

    resolve(response);
  });
}

async function saveDisco(electricPlan, selectedDisco, sessionId) {
  return new Promise(async (resolve) => {
    if (electricPlan === "prepaid") {
      let [planCode] = await redisClient.zrangebyscoreAsync(
        `${APP_PREFIX_REDIS}:Discos:Prepaid:Code`,
        selectedDisco,
        selectedDisco
      );
      await redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "QS_update_elec_disco",
        planCode
      );
      console.log(planCode);
      resolve();
    } else {
      //   if (selectedDisco === "4") {
      //     selectedDisco = "5";
      //   } else if (selectedDisco === "5") {
      //     selectedDisco = "7";
      //   }
      let [planCode] = await redisClient.zrangebyscoreAsync(
        `${APP_PREFIX_REDIS}:Discos:Postpaid:Code`,
        selectedDisco,
        selectedDisco
      );
      await redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "QS_update_elec_disco",
        planCode
      );
      console.log(planCode);
      resolve();
    }
  });
}

function viewProfile(mongo_userId, profileName, sessionId) {
  return new Promise(async (resolve) => {
    let profile = await mongoFront.findExistingProfile(
      mongo_userId,
      profileName,
      "electricity"
    );
    if (profile) {
      let { name, _id } = profile;
      await redisClient.hmsetAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`,
        "QS_update_elec_oldname",
        name,
        "QS_update_elec_profileID",
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
    let profiles = await mongoFront.getTopProfiles(mongo_userId, "electricity");
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
      QS_update_elec_name,
      QS_update_elec_plan,
      QS_update_elec_disco,
      QS_update_elec_amount,
      QS_update_elec_meterNo,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
    let response = "";

    response = `CON Confirm beneficiary:\nName: ${QS_update_elec_name}\nPlan: ${QS_update_elec_plan}\nDisco: ${QS_update_elec_disco}\nMeterNo:${QS_update_elec_meterNo}\nDefaultAmount: ${formatNumber(
      QS_update_elec_amount
    )}\n\n1 Confirm\n2 Cancel`;

    resolve(response);
  });
}

module.exports = { updateElectricityProfile };
