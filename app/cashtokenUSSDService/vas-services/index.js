const { processLCC } = require("./LCC");
const { process1KOnlyAirtime } = require("./airtime1KOnlyPurchase");
const { processAirtime } = require("./airtimePurchase");
const { processCableTv } = require("./cabletvPayment");
const { processData } = require("./dataBundlePurchase");
const { processElectricity } = require("./electricityPayment");
const { processGiftCashToken } = require("./giftCashToken");
const { servePayBillsRequest } = require("./payBills");

module.exports = {
  process1KOnlyAirtime,
  processAirtime,
  processCableTv,
  processData,
  processElectricity,
  processLCC,
  processGiftCashToken,
  servePayBillsRequest,
};
