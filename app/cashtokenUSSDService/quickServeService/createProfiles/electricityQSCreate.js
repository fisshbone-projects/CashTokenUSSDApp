const { redisClient } = require("$config/redisConnectConfig");
const { displayListOfDiscos, confirmMeterNo } = require("$felaLibs");
const mongoFront = require("$mongoLibs/mongoFront");
const { APP_PREFIX_REDIS, formatNumber } = require("$utils");

function createElectricityProfile(text, phoneNumber, sessionId) {
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
          "QS_Elec_name",
          profileName.toLowerCase()
        );

        response = "CON Select Beneficiary's Plan:\n1 Prepaid\n2 Postpaid";
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
      let selectedPlan = brokenDownText[textlength - 1];

      if (selectedPlan === "1") {
        redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_Elec_plan",
          "prepaid"
        );

        response = `CON Select Disco:\n`;
        let discos = await displayListOfDiscos("prepaid");
        response += discos;
      } else if (selectedPlan === "2") {
        redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_Elec_plan",
          "postpaid"
        );
        response = `CON Select Disco:\n`;
        let discos = await displayListOfDiscos("postpaid");
        response += discos;
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else if (textlength === 6) {
      let { QS_Elec_plan: chosenPlan } = await redisClient.hgetallAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`
      );

      let chosenDisco = brokenDownText[textlength - 1];
      if (Number(chosenDisco) <= 9 && Number(chosenDisco) >= 1) {
        console.log(chosenPlan, chosenDisco);
        await saveDisco(chosenPlan, chosenDisco, sessionId);
        response = "CON Enter Beneficiary's Meter Number:";
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else if (textlength === 7) {
      let meterNumber = brokenDownText[textlength - 1];
      let {
        QS_Elec_plan: chosenPlan,
        QS_Elec_disco: chosenDisco,
      } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
      let { verified, minimumAmount } = await confirmMeterNo(
        meterNumber,
        chosenPlan,
        chosenDisco
      );
      if (verified) {
        redisClient.hmsetAsync(
          `${APP_PREFIX_REDIS}:${sessionId}`,
          "QS_Elec_meterNo",
          meterNumber,
          "QS_Elec_minAmount",
          minimumAmount
        );

        response = "CON Enter Default Amount to Purchase for this Beneficiary:";
      } else {
        response =
          "CON Error!\nInputed meter number cannot be verified \n\n0 Menu";
      }
    } else if (textlength === 8) {
      let inputedAmount = brokenDownText[textlength - 1];
      let { QS_Elec_minAmount: minimumAmount } = await redisClient.hgetallAsync(
        `${APP_PREFIX_REDIS}:${sessionId}`
      );
      if (/^[0-9]*$/.test(inputedAmount)) {
        if (
          Number(inputedAmount) >= minimumAmount &&
          Number(inputedAmount) <= 100000
        ) {
          await redisClient.hmsetAsync(
            `${APP_PREFIX_REDIS}:${sessionId}`,
            "QS_Elec_amount",
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
    } else if (textlength === 9) {
      let userResponse = brokenDownText[textlength - 1];
      if (userResponse === "2") {
        response = "END Beneficiary creation process canceled by user";
      } else if (userResponse === "1") {
        let {
          mongo_userId,
          QS_Elec_name,
          QS_Elec_plan,
          QS_Elec_disco,
          QS_Elec_meterNo,
          QS_Elec_amount,
        } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);

        let beneficiaryExists = await mongoFront.findExistingProfile(
          mongo_userId,
          QS_Elec_name,
          "electricity"
        );

        if (!beneficiaryExists) {
          console.log("Creating a new electricity beneficiary");
          let elecDoc = {
            name: QS_Elec_name,
            plan: QS_Elec_plan,
            disco: QS_Elec_disco,
            meterNumber: QS_Elec_meterNo,
            defaultAmount: QS_Elec_amount,
            customer: mongo_userId,
          };
          let newId = await mongoFront.createProfile(elecDoc, "electricity");
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
            "QS_Elec_oldProfileId",
            beneficiaryExists._id.toString()
          );
          response = `CON You currently have a beneficiary with the name '${QS_Elec_name}'. Will you like to update this beneficiary instead?\n\n1 Yes\n2 No`;
        }
      } else {
        response = "CON Error! Wrong option inputed\n\n0 Menu";
      }
    } else if (textlength === 10) {
      let userResponse = brokenDownText[textlength - 1];
      if (userResponse === "2") {
        response = "END Beneficiary creation process canceled by user";
      } else if (userResponse === "1") {
        let {
          mongo_userId,
          QS_Elec_name,
          QS_Elec_plan,
          QS_Elec_disco,
          QS_Elec_meterNo,
          QS_Elec_amount,
          QS_Elec_oldProfileId,
        } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
        let elecDoc = {
          name: QS_Elec_name,
          plan: QS_Elec_plan,
          disco: QS_Elec_disco,
          meterNumber: QS_Elec_meterNo,
          defaultAmount: QS_Elec_amount,
          customer: mongo_userId,
          updatedAt: Date.now(),
        };
        let updated = await mongoFront.updateProfile(
          QS_Elec_oldProfileId,
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
        "QS_Elec_disco",
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
        "QS_Elec_disco",
        planCode
      );
      console.log(planCode);
      resolve();
    }
  });
}

function generateSummary(sessionId) {
  return new Promise(async (resolve) => {
    let {
      QS_Elec_name,
      QS_Elec_plan,
      QS_Elec_disco,
      QS_Elec_amount,
    } = await redisClient.hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`);
    let response = "";

    response = `CON Confirm beneficiary:\nName: ${QS_Elec_name}\nPlan: ${QS_Elec_plan}\nDisco: ${QS_Elec_disco}\nDefaultAmount: ${formatNumber(
      QS_Elec_amount
    )}\n\n1 Confirm\n2 Cancel`;

    resolve(response);
  });
}

module.exports = { createElectricityProfile };
