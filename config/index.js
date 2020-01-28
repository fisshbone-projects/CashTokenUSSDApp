const path = require("path");

const ENV = process.env.NODE_ENV || "development";

require("dotenv").config({
  path: path.resolve(__dirname, `../.development.env`)
});

const Config = Object.freeze({
  App: {
    ENV,
    PROD: process.env.NODE_ENV === "production",
    REDIS_ENV: process.env.REDIS_ENV,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_AUTH: process.env.REDIS_AUTH,
    REDIS_API_DATA_EXPIRE: process.env.REDIS_EXPIRE_API_INFO
  },
  FelaMarketPlace: {
    BASE_URL:
      ENV === "production"
        ? process.env.FELA_BASE_URL_PROD
        : process.env.FELA_BASE_URL_STAGING,
    AUTH_BEARER:
      ENV === "production"
        ? process.env.FELA_AUTH_BEARER_PROD
        : process.env.FELA_AUTH_BEARER_STAGING,
    THIS_SOURCE: process.env.FELA_THIS_SOURCE
  },
  INFOBIP: {
    BASE_URL: process.env.INFOBIP_URL,
    API_KEY: process.env.INFOBIP_API_KEY
  }
});

console.log(Config);

module.exports = Config;
