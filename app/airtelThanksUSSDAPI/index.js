const {
  getWalletBalance,
  getUserStatus,
  fulfilWalletActivation,
  fulfilCashOut,
  listBanks,
  purchaseAirtime,
  purchaseData,
  listDataPlans
} = require("./APIServices");

async function processUSSDRequests(action, params, user) {
  return new Promise(async resolve => {
    let response = "";

    switch (action.name) {
      case "userStatus":
        console.log(`Serving userStatus for ${user.msisdn}`);
        response = await getUserStatus(user);
        resolve(response);
        break;
      case "walletActivation":
        console.log(`Fulfiling walletActivation for ${user.msisdn}`);
        response = await fulfilWalletActivation(params, user);
        resolve(response);
        break;
      case "walletBalance":
        console.log(`Serving walletBalance for ${user.msisdn}`);
        response = await getWalletBalance(user);
        resolve(response);
        break;
      case "cashout":
        console.log(`Serving wallet cashout for ${user.msisdn}`);
        response = await fulfilCashOut(params, user);
        resolve(response);
        break;
      case "listBanks":
        console.log(`Serving listBanks for ${user.msisdn}`);
        response = await listBanks();
        resolve(response);
        break;
      case "purchaseAirtime":
        console.log(`Serving purchaseAirtime for ${user.msisdn}`);
        response = await purchaseAirtime(params, user);
        resolve(response);
        break;
      case "purchaseData":
        console.log(`Serving purchaseData for ${user.msisdn}`);
        response = await purchaseData(params, user);
        resolve(response);
        break;
      case "listDataPlans":
        console.log(`Serving listDataPlans for ${user.msisdn}`);
        response = await listDataPlans();
        resolve(response);
        break;
      default:
        console.log("Attempted call on a non-existent action");
        resolve({
          code: 404,
          message:
            "Error, this action is not available on this API, please reference the documentation for the list of actions we serve"
        });
    }
  });
}

module.exports = {
  processUSSDRequests
};
