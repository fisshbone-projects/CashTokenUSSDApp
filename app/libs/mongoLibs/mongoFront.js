const mongo = require("$config/mongodbConfig");
const Many = require("extends-classes");
const UserFront = require("./userMongoFront");
const QSMongoFront = require("./quickServeProfilesMongoFront");

class MongoFront extends Many(UserFront, QSMongoFront) {}

module.exports = new MongoFront();
