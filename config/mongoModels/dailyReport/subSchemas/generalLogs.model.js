const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { setupSchema } = require("../utils");
const { globalKeyMap } = require("../../../utils");

let GeneralLogSchema = new Schema({
  _id: false,
});

let GeneralLogs = mongoose.model("GeneralLogs", GeneralLogSchema);

setupSchema(globalKeyMap, GeneralLogs);

module.exports = { GeneralLogSchema };
