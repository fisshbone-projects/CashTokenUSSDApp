const { UserModel } = require("$mongoModels/index");

class UserMongoFront {
  async findUser(phoneNumber) {
    let user = await UserModel.findOne({ phoneNumber: phoneNumber });
    if (user) {
      return user._id.toString();
    } else {
      return null;
    }
  }

  async createUser(userDoc) {
    try {
      let { _id } = await UserModel.create(userDoc);
      return _id.toString();
    } catch (err) {
      console.log(err);
      return Promise.reject("Cannot create user");
    }
  }

  async updateUserLastActive(phoneNumber) {
    try {
      await UserModel.updateOne(
        { phoneNumber },
        { lastActive: Date.now(), updatedAt: Date.now() }
      );
      return;
    } catch (err) {
      console.log(err);
      return Promise.reject("Cannot update user's last active field");
    }
  }
}

module.exports = UserMongoFront;
