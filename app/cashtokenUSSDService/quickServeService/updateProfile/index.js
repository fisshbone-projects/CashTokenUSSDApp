const { redisClient } = require("$config/redisConnectConfig");
const { updateAirtimeProfile } = require("./airtimeQSUpdate");
const { updateLccProfile } = require("./lccQSUpdate");
const { updateCabletvProfile } = require("./cabletvQSUpdate");
const { updateElectricityProfile } = require("./electricityQSUpdate");
const { updateDatabundleProfile } = require("./databundleQSUpdate");

function updateQSProfile(text, phoneNumber, sessionId) {
  return new Promise(async (resolve) => {
    let response = "";
    if (text === "1*2") {
      response = "CON 1 Airtime\n2 DataBundle\n3 CableTV\n4 Electricity\n5 LCC";
    } else if (text.startsWith("1*2*1")) {
      response = await updateAirtimeProfile(text, phoneNumber, sessionId);
    } else if (text.startsWith("1*2*2")) {
      response = await updateDatabundleProfile(text, phoneNumber, sessionId);
    } else if (text.startsWith("1*2*3")) {
      response = await updateCabletvProfile(text, phoneNumber, sessionId);
    } else if (text.startsWith("1*2*4")) {
      response = await updateElectricityProfile(text, phoneNumber, sessionId);
    } else if (text.startsWith("1*2*5")) {
      response = await updateLccProfile(text, phoneNumber, sessionId);
    }
    resolve(response);
  });
}

module.exports = { updateQSProfile };
