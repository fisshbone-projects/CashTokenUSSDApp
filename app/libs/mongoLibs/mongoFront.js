const mongo = require("../../../config/mongodbConfig");
const Many = require("extends-classes");
const UserFront = require("./userMongoFront");

class MongoFront extends Many(UserFront) {}

module.exports = new MongoFront();
