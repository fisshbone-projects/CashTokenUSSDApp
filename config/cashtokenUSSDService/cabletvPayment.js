const { redisClient } = require("../redisConnectConfig");
const { FelaMarketPlace, App } = require("../index");
const { APP_PREFIX_REDIS } = require("../utils");
const axios = require("axios");
const felaHeader = { Authorization: `Bearer ${FelaMarketPlace.AUTH_BEARER}` };
const API_DATA_EXPIRE_TIME = parseInt(App.REDIS_API_DATA_EXPIRE);

async function processCableTv(phoneNumber, text, sessionId) {
  return new Promise(async (resolve, reject) => {
    resolve(
      `CON Welcome!!!\nThis service is still under development, but please check back soon, we are always ready to serve you.\n\nEnter 0 Back to home menu`
    );
  });
}

module.exports = {
  processCableTv
};
