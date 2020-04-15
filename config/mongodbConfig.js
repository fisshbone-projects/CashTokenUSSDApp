const {
  App: { MONGO_CONNECT }
} = require("./index");
const mongoose = require("mongoose");

mongoose
  .connect(MONGO_CONNECT, { useNewUrlParser: true, useUnifiedTopology: true })
  .catch(error => {
    console.log("Could not connect to MongoDB\n", error);
  });
mongoose.Promise = global.Promise;

let db = mongoose.connection;

db.on("connected", () => {
  console.log("MongoDB connected Successfully");
});

module.exports = db;
