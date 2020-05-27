const {
  UserModel,
  AirtimeQS,
  LccQS,
  CabletvQS,
  ElectricityQS,
  DatabundleQS,
} = require("$mongoModels/index");

class QSMongoFront {
  async createProfile(doc, service) {
    try {
      let createResponse = null;
      switch (service) {
        case "airtime":
          let { _id: airtimeId } = await AirtimeQS.create(doc);
          createResponse = airtimeId.toString();
          break;
        case "lcc":
          let { _id: lccId } = await LccQS.create(doc);
          createResponse = lccId.toString();
          break;
        case "cabletv":
          let { _id: cabletvId } = await CabletvQS.create(doc);
          createResponse = cabletvId.toString();
          break;
        case "electricity":
          let { _id: elecId } = await ElectricityQS.create(doc);
          createResponse = elecId.toString();
          break;
        case "databundle":
          let { _id: dataId } = await DatabundleQS.create(doc);
          createResponse = dataId.toString();
          break;
      }

      return createResponse;
    } catch (err) {
      console.log("Cannot create Profile");
      console.log(err);
      return null;
    }
  }

  async updateProfile(profileId, doc, service) {
    try {
      let allGood = null;

      switch (service) {
        case "airtime":
          let { ok: airtimeOk } = await AirtimeQS.updateOne(
            { _id: profileId },
            doc
          );
          allGood = airtimeOk;
          break;
        case "lcc":
          let { ok: lccOk } = await LccQS.updateOne({ _id: profileId }, doc);
          allGood = lccOk;
          break;
        case "cabletv":
          let { ok: cabletvOk } = await CabletvQS.updateOne(
            { _id: profileId },
            doc
          );
          allGood = cabletvOk;
          break;
        case "electricity":
          let { ok: elecOk } = await ElectricityQS.updateOne(
            { _id: profileId },
            doc
          );
          allGood = elecOk;
          break;
        case "databundle":
          let { ok: dataOk } = await DatabundleQS.updateOne(
            { _id: profileId },
            doc
          );
          allGood = dataOk;
          break;
      }
      return allGood;
    } catch (err) {
      console.log("Cannot update Profile");
      console.log(err);
      return null;
    }
  }

  async findExistingProfile(userId, profileName, service) {
    let exists = null;
    switch (service) {
      case "airtime":
        exists = await AirtimeQS.findOne({
          customer: userId,
          name: profileName,
        });
        break;
      case "lcc":
        exists = await LccQS.findOne({
          customer: userId,
          name: profileName,
        });
        break;
      case "cabletv":
        exists = await CabletvQS.findOne({
          customer: userId,
          name: profileName,
        });
        break;
      case "electricity":
        exists = await ElectricityQS.findOne({
          customer: userId,
          name: profileName,
        });
        break;
      case "databundle":
        exists = await DatabundleQS.findOne({
          customer: userId,
          name: profileName,
        });
        break;
    }

    if (exists) {
      return exists;
    } else {
      return null;
    }
  }

  async getTopProfiles(userId, service) {
    let topProfiles = [];
    let respProfiles = null;

    switch (service) {
      case "airtime":
        respProfiles = await AirtimeQS.find({ customer: userId })
          .sort({ successfulTransactions: -1 })
          .limit(4)
          .exec();
        break;
      case "lcc":
        respProfiles = await LccQS.find({ customer: userId })
          .sort({ successfulTransactions: -1 })
          .limit(4)
          .exec();
        break;
      case "cabletv":
        respProfiles = await CabletvQS.find({ customer: userId })
          .sort({ successfulTransactions: -1 })
          .limit(4)
          .exec();
        break;
      case "electricity":
        respProfiles = await ElectricityQS.find({ customer: userId })
          .sort({ successfulTransactions: -1 })
          .limit(4)
          .exec();
        break;
      case "databundle":
        respProfiles = await DatabundleQS.find({ customer: userId })
          .sort({ successfulTransactions: -1 })
          .limit(4)
          .exec();
        break;
    }

    if (respProfiles.length === 0) {
      return topProfiles;
    } else {
      for (let profile of respProfiles) {
        topProfiles.push(profile.name);
      }
      return topProfiles;
    }
  }

  async deleteProfile(userId, profileName, service) {
    try {
      let allGood = null;

      switch (service) {
        case "airtime":
          let { ok: airtimeOk } = await AirtimeQS.deleteOne({
            customer: userId,
            name: profileName,
          });
          allGood = airtimeOk;
          break;
        case "lcc":
          let { ok: lccOk } = await LccQS.deleteOne({
            customer: userId,
            name: profileName,
          });
          allGood = lccOk;
          break;
        case "cabletv":
          let { ok: cabletvOk } = await CabletvQS.deleteOne({
            customer: userId,
            name: profileName,
          });
          allGood = cabletvOk;
          break;
        case "electricity":
          let { ok: elecOk } = await ElectricityQS.deleteOne({
            customer: userId,
            name: profileName,
          });
          allGood = elecOk;
          break;
        case "databundle":
          let { ok: dataOk } = await DatabundleQS.deleteOne({
            customer: userId,
            name: profileName,
          });
          allGood = dataOk;
          break;
      }
      return allGood;
    } catch (err) {
      console.log("Cannot delete Profile");
      console.log(err);
      return null;
    }
  }
}

module.exports = QSMongoFront;
