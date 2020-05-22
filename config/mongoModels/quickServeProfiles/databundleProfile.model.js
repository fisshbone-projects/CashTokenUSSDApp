const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const UserModel = require("../user/user.model");

let DatabundleQS_Schema = new Schema({
  name: { type: String, required: true },
  networkName: { type: String, required: true },
  networkCode: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  defaultBundleName: { type: String, required: true },
  defaultBundleCode: { type: String, required: true },
  defaultBundlePrice: { type: String, required: true },
  customer: { type: Schema.Types.ObjectId, ref: UserModel, required: true },
  successfulTransactions: { type: Number },
  createdAt: { type: Date },
  updatedAt: { type: Date },
});

DatabundleQS_Schema.pre("save", function (next) {
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
  "DatabundleQS",
  DatabundleQS_Schema,
  "databundleQS_profiles"
);
