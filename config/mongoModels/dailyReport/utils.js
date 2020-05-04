const { camelize } = require("../../utils");
const mongooseDynamic = require("mongoose-dynamic-schemas");

exports.setupSchema = (keyMap, model) => {
  Object.values(keyMap).forEach((value) => {
    let name = camelize(value);
    name = name.replace("/", "");
    mongooseDynamic.addSchemaField(model, name, { type: Number });
  });
};
