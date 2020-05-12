const mongoose = require("mongoose");
const mongooseDynamic = require("mongoose-dynamic-schemas");
const Schema = mongoose.Schema;
const { purchasesKeyMap, camelize } = require("../../../../app/utils");

let PurchasesLogSchema = new Schema({
  _id: false,
});

let PurchasesLog = mongoose.model("PurchasesLog", PurchasesLogSchema);

const setupSchema = (keyMap, model) => {
  Object.values(keyMap).forEach((value) => {
    let name = camelize(value);
    name = name.replace("/", "");
    mongooseDynamic.addSchemaField(model, name, {
      totalCount: { type: Number },
      totalAmount: { type: Number },
    });
  });
};

setupSchema(purchasesKeyMap, PurchasesLog);

module.exports = { PurchasesLogSchema };
