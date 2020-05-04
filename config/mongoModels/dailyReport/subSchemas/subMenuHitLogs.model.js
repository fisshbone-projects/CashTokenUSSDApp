const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { setupSchema } = require("../utils");
const { subMenuKeyMap } = require("../../../utils");

let SubMenuHitSchema = new Schema({
  _id: false,
});

let SubMenuHits = mongoose.model("SubMenuHits", SubMenuHitSchema);

setupSchema(subMenuKeyMap, SubMenuHits);

module.exports = { SubMenuHitSchema };
