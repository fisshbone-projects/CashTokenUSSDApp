const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const UserModel = require("../user/user.model");

let ElectricityQS_Schema = new Schema({
  name: { type: String, required: true },
  plan: { type: String, required: true },
  disco: { type: String, required: true },
  meterNumber: { type: String, required: true },
  defaultAmount: { type: String, required: true },
  customer: { type: Schema.Types.ObjectId, ref: UserModel, required: true },
  successfulTransactions: { type: Number },
  createdAt: { type: Date },
  updatedAt: { type: Date },
});

ElectricityQS_Schema.pre("save", function (next) {
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
  "ElectricityQS",
  ElectricityQS_Schema,
  "electricityQS_profiles"
);
