const { UserModel, AirtimeQS } = require("$mongoModels/index");

class QSMongoFront {
  async createAirtimeProfile(airtimeDoc) {
    try {
      let { _id } = await AirtimeQS.create(airtimeDoc);
      return _id.toString();
    } catch (err) {
      console.log(err);
      return Promise.reject("Cannot create Airtime Profile");
    }
  }

  async updateAirtimeProfile(profileId, airtimeDoc) {
    try {
      let { ok } = await AirtimeQS.updateOne({ _id: profileId }, airtimeDoc);

      return ok;
    } catch (err) {
      console.log(err);
      return Promise.reject("Cannot create Airtime Profile");
    }
  }

  async findExistingAirtimeProfile(userId, profileName) {
    let exists = await AirtimeQS.findOne({
      customer: userId,
      name: profileName,
    });

    if (exists) {
      return exists;
    } else {
      return null;
    }
  }
}

module.exports = QSMongoFront;
