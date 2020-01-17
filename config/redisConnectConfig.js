const promisify = require("bluebird");
const redis = require("redis");
const { App } = require("./index");

promisify.promisifyAll(require("redis"));

let redisClient = null;

if (App.REDIS_ENV === "staging") {
  redisClient = redis.createClient(App.REDIS_PORT, App.REDIS_HOST);

  redisClient.auth(App.REDIS_AUTH, (err, resp) => {
    console.log(`Auth passed ${resp}`);
  });

  redisClient.on("connect", () => {
    console.log("Server connected to the Redis DB");
  });
  redisClient.on("error", err => {
    console.error("Error connecting to Redis Server" + err);
  });
} else if (App.REDIS_ENV === "local") {
  redisClient = redis.createClient(6379);
  redisClient.on("connect", () => {
    console.log("Server connected to the Redis DB");
  });
  redisClient.on("error", err => {
    console.error("Error connecting to Redis Server" + err);
  });
}

module.exports = { redisClient };
