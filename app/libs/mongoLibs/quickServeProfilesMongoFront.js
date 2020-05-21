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
      console.log(err);
      return Promise.reject("Cannot create Profile");
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
      console.log(err);
      return Promise.reject("Cannot update Profile");
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
}

module.exports = QSMongoFront;
