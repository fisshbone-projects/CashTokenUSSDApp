const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const UserModel = require("../user/user.model");

let AirtimeQS_Schema = new Schema({
  name: { type: String, required: true },
  network: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  defaultAmount: { type: String, required: true },
  customer: { type: Schema.Types.ObjectId, ref: UserModel, required: true },
  successfulTransactions: { type: Number },
  createdAt: { type: Date },
  updatedAt: { type: Date },
});

AirtimeQS_Schema.pre("save", function (next) {
  let now = Date.now();
  // console.log("Called the update");

  this.updatedAt = now;
  //Set a value for createdAt only if it is null
  if (!this.createdAt) {
    this.createdAt = now;
  }

  //Call the next function in the pre-save chain
  next();
});

module.exports = mongoose.model(
  "AirtimeQS",
  AirtimeQS_Schema,
  "airtimeQS_profiles"
);
