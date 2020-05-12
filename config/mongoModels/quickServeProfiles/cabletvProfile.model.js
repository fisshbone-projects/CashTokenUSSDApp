const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const UserModel = require("../user/user.model");

let CabletvQS_Schema = new Schema({
  name: { type: String, required: true },
  provider: { type: String, required: true },
  cardNumber: { type: String, required: true },
  defaultBouquet: { type: String, required: true },
  customer: { type: Schema.Types.ObjectId, ref: UserModel, required: true },
  successfulTransactions: { type: Number },
  createdAt: { type: Date },
  updatedAt: { type: Date },
});

CabletvQS_Schema.pre("save", function (next) {
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
  "CableQS",
  CabletvQS_Schema,
  "cabletvQS_profiles"
);
