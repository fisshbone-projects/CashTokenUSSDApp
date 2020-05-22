const { redisClient } = require("$config/redisConnectConfig");
const { createAirtimeProfile } = require("./airtimeQSCreate");
const { createLccProfile } = require("./lccQSCreate");
const { createCabletvProfile } = require("./cabletvQSCreate");
const { createElectricityProfile } = require("./electricityQSCreate");
const { createDatabundleProfile } = require("./databundleQSCreate");

function createQSProfile(text, phoneNumber, sessionId) {
  return new Promise(async (resolve) => {
    let response = "";
    if (text === "1*1") {
      response = "CON 1 Airtime\n2 DataBundle\n3 CableTV\n4 Electricity\n5 LCC";
    } else if (text.startsWith("1*1*1")) {
      response = await createAirtimeProfile(text, phoneNumber, sessionId);
    } else if (text.startsWith("1*1*2")) {
      response = await createDatabundleProfile(text, phoneNumber, sessionId);
    } else if (text.startsWith("1*1*3")) {
      response = await createCabletvProfile(text, phoneNumber, sessionId);
    } else if (text.startsWith("1*1*4")) {
      response = await createElectricityProfile(text, phoneNumber, sessionId);
    } else if (text.startsWith("1*1*5")) {
      response = await createLccProfile(text, phoneNumber, sessionId);
    }
    resolve(response);
  });
}

module.exports = { createQSProfile };
