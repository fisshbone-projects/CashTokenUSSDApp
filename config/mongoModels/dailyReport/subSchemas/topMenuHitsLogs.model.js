const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { setupSchema } = require("../utils");
const { topMenuKeyMap } = require("../../../../app/utils");

let TopMenuHitSchema = new Schema({
  _id: false,
});

let TopMenuHits = mongoose.model("TopMenuHits", TopMenuHitSchema);

setupSchema(topMenuKeyMap, TopMenuHits);

module.exports = { TopMenuHitSchema };
