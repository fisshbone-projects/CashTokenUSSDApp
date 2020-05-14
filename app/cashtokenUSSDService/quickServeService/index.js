const { redisClient } = require("../../../config/redisConnectConfig");
const { createQSProfile } = require("./createProfiles/");

function quickServeService(text, phoneNumber, sessionId) {
  return new Promise(async (resolve) => {
    let response = "";
    if (text === "1") {
      response = `CON Welcome to the QuickServe Service\n1 Create Profiles\n2 Update Profiles\n3 View Profiles\n4 Delete Profiles`;
    } else if (text.startsWith("1*1")) {
      response = createQSProfile(text, phoneNumber, sessionId);
    }
    //Add other QS services...

    resolve(response);
  });
}

module.exports = { quickServeService };
