const { redisClient } = require("$config/redisConnectConfig");
const { deleteAirtimeProfile } = require("./airtimeQSDelete");
const { deleteLccProfile } = require("./lccQSDelete");
const { deleteCabletvProfile } = require("./cabletvQSDelete");
const { deleteElectricityProfile } = require("./electricityQSDelete");
const { deleteDatabundleProfile } = require("./databundleQSDelete");

function deleteQSProfile(text, phoneNumber, sessionId) {
  return new Promise(async (resolve) => {
    let response = "";
    if (text === "1*4") {
      response = "CON 1 Airtime\n2 DataBundle\n3 CableTV\n4 Electricity\n5 LCC";
    } else if (text.startsWith("1*4*1")) {
      response = await deleteAirtimeProfile(text, phoneNumber, sessionId);
    } else if (text.startsWith("1*4*2")) {
      response = await deleteDatabundleProfile(text, phoneNumber, sessionId);
    } else if (text.startsWith("1*4*3")) {
      response = await deleteCabletvProfile(text, phoneNumber, sessionId);
    } else if (text.startsWith("1*4*4")) {
      response = await deleteElectricityProfile(text, phoneNumber, sessionId);
    } else if (text.startsWith("1*4*5")) {
      response = await deleteLccProfile(text, phoneNumber, sessionId);
    }
    resolve(response);
  });
}

module.exports = { deleteQSProfile };
