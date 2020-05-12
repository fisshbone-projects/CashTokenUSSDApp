const mongoose = require("mongoose");
const Schema = mongoose.Schema;
var uniqueValidator = require("mongoose-unique-validator");

let UserSchema = new Schema({
  phoneNumber: { type: String, required: true, unique: true },
  lastActive: { type: Date },
  totalPurchaseAttempt: { type: Number },
  createdAt: { type: Date },
  updatedAt: { type: Date },
});

UserSchema.plugin(uniqueValidator);

UserSchema.pre("save", function (next) {
  let now = Date.now();

  this.updatedAt = now;
  //Set a value for createdAt only if it is null
  if (!this.createdAt) {
    this.createdAt = now;
  }

  //Call the next function in the pre-save chain
  next();
});

module.exports = mongoose.model("User", UserSchema, "user");
