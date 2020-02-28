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
  LCC: {
    LCC_PROVIDER_CODE:
      ENV === "production"
        ? process.env.LCC_PROVIDER_CODE_PROD
        : process.env.LCC_PROVIDER_CODE_STAGING,
    LCC_TOLL_SERVICE_CODE:
      ENV === "production"
        ? process.env.LCC_TOLL_SERVICE_CODE_PROD
        : process.env.LCC_TOLL_SERVICE_CODE_STAGING
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
  },
  CELD: {
    BASE_URL:
      ENV === "production"
        ? process.env.CELD_BASE_URL_PROD
        : process.env.CELD_BASE_URL_STAGING,
    PUBLIC_KEY:
      ENV === "production"
        ? "90101912909"
        : process.env.CELD_PUBLIC_KEY_STAGING,
    PRIVATE_KEY:
      ENV === "production"
        ? "90128812912"
        : process.env.CELD_PRIVATE_KEY_STAGING
  }
});

console.log(Config);

module.exports = Config;
