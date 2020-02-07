const { redisClient } = require("../redisConnectConfig");
const {
  DIRECTDIALSERVICE,
  checkUserActivationStatus
} = require("./directDialUtils");
const { processWalletCashout } = require("./walletCashoutService");

async function processDirectDial(sessionId, userPhone, text) {
  let directDialService = text.substring(0, 2);
  let serviceOffering = detectDDService(directDialService);
  let response = "";

  let { status: userStatus } = await checkUserActivationStatus(userPhone);
  if (userStatus === "active") {
    switch (serviceOffering) {
      case "CASHOUT":
        response = await processWalletCashout(sessionId, userPhone, text);
        break;
    }
  } else {
    response = `END You have reached CashToken Direct Dial Service.\nYour wallet is not activated.\nDial *347*999# to activate your wallet and then you use Direct Dial.`;
  }

  return response;
}

function detectDDService(serviceString) {
  let serviceOffering = "";
  for ([DDService, DDCode] of Object.entries(DIRECTDIALSERVICE)) {
    if (serviceString == DDCode) {
      console.log(`Servicing Direct Dial: ${DDService}`);
      serviceOffering = DDService;
    }
  }
  return serviceOffering;
}

module.exports = {
  processDirectDial
};
