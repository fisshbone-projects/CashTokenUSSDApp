const { FelaMarketPlace, App } = require("$config");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
const underscore = require("underscore.string");
const { formatNumber } = require("$utils");
const moment = require("moment");

async function showLastElectricityPurchase(msisdn) {
  try {
    let purchaseDetails = await fetchLastPurchase(msisdn);
    console.log(purchaseDetails);
    let response = `CON Disco: ${
      purchaseDetails.provider
    } (${underscore.humanize(purchaseDetails.plan)})\nMeterNo: ${
      purchaseDetails.meterNo
    }\nAmount: ${formatNumber(purchaseDetails.amount)}\nMeterToken: ${
      purchaseDetails.meterToken
    }\nUnits: ${purchaseDetails.totalUnits}kWh\nTransactionDate: ${moment(
      purchaseDetails.dateTime
    ).format("DD-MM-YYYY")}\n\n0 Menu`;
    return response;
  } catch (err) {
    return `CON You don't have any recent successful purchase at the moment\n\n0 Menu`;
  }
}

function fetchLastPurchase(phoneNumber) {
  return new Promise(async (resolve, reject) => {
    try {
      let response = await axios.get(
        `${FelaMarketPlace.BASE_URL}/info/lastElectricityPurchase?msisdn=${phoneNumber}`,
        {
          headers: felaHeader,
        }
      );
      resolve(response.data.data);
    } catch (error) {
      console.log("error");
      console.log(error.response.data);
      reject();
    }
  });
}

module.exports = {
  showLastElectricityPurchase,
};
