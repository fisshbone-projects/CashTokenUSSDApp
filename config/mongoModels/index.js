const DailyReportModel = require("./dailyReport/dailyReport.model");
const UserModel = require("./user/user.model");
const AirtimeQS = require("./quickServeProfiles/airtimeProfile.model");
const CabletvQS = require("./quickServeProfiles/cabletvProfile.model");
const ElectricityQS = require("./quickServeProfiles/electricityProfile.model");
const DatabundleQS = require("./quickServeProfiles/databundleProfile.model");
const LccQS = require("./quickServeProfiles/lccProfile.model");

module.exports = {
  AirtimeQS,
  DailyReportModel,
  UserModel,
  CabletvQS,
  ElectricityQS,
  DatabundleQS,
  LccQS,
};
