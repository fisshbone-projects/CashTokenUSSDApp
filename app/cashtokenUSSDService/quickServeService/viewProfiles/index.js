const { redisClient } = require("$config/redisConnectConfig");
const { viewAirtimeProfile } = require("./airtimeQSView");
const { viewLccProfile } = require("./lccQSView");
const { viewCabletvProfile } = require("./cabletvQSView");
const { viewElectricityProfile } = require("./electricityQSView");
const { viewDatabundleProfile } = require("./databundleQSView");

function viewQSProfile(text, phoneNumber, sessionId) {
  return new Promise(async (resolve) => {
    let response = "";
    if (text === "1*3") {
      response = "CON 1 Airtime\n2 DataBundle\n3 CableTV\n4 Electricity\n5 LCC";
    } else if (text.startsWith("1*3*1")) {
      response = await viewAirtimeProfile(text, phoneNumber, sessionId);
    } else if (text.startsWith("1*3*2")) {
      response = await viewDatabundleProfile(text, phoneNumber, sessionId);
    } else if (text.startsWith("1*3*3")) {
      response = await viewCabletvProfile(text, phoneNumber, sessionId);
    } else if (text.startsWith("1*3*4")) {
      response = await viewElectricityProfile(text, phoneNumber, sessionId);
    } else if (text.startsWith("1*3*5")) {
      response = await viewLccProfile(text, phoneNumber, sessionId);
    }
    resolve(response);
  });
}

module.exports = { viewQSProfile };
