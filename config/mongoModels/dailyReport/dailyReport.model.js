const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { GeneralLogSchema } = require("./subSchemas/generalLogs.model");
const { TopMenuHitSchema } = require("./subSchemas/topMenuHitsLogs.model");
const { SubMenuHitSchema } = require("./subSchemas/subMenuHitLogs.model");
const { PurchasesLogSchema } = require("./subSchemas/purchasesLogs");

let DailyReportSchema = new Schema(
  {
    reportDate: { type: String },
    generalLogs: GeneralLogSchema,
    topMenuHitLogs: TopMenuHitSchema,
    subMenuHitLogs: SubMenuHitSchema,
    purchasesLogs: PurchasesLogSchema,
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { versionKey: false }
);

DailyReportSchema.pre("save", function (next) {
  let now = Date.now();

  this.updatedAt = now;
  //Set a value for createdAt only if it is null
  if (!this.createdAt) {
    this.createdAt = now;
  }

  //Call the next function in the pre-save chain
  next();
});

module.exports = mongoose.model(
  "DailyReport",
  DailyReportSchema,
  "dailyReports"
);
