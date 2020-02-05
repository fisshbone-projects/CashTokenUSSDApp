const axios = require("axios");
const { CELD } = require("../index");
const crypto = require("crypto");
const number = "08029150812";
const ePIN = "9937";

let createHash = (algo, message, digest = "hex") => {
  let hash = crypto.createHash(algo);
  return hash.update(message).digest(digest);
};

let generateHeader = (message = "") => {
  let header = {
    Authorization: `Bearer ${CELD.PUBLIC_KEY} ${createHash(
      "sha512",
      JSON.stringify(message) + CELD.PRIVATE_KEY
    )}`
  };
  return header;
};

let authenticateUser = () => {
  return new Promise(resolve => {
    let payload = {
      data: {
        userPhoneNo: number,
        userPin: ePIN
      }
    };

    axios
      .post(`${CELD.BASE_URL}/celdmobile/loginWithPin`, payload, {
        headers: generateHeader(payload)
      })
      .then(resp => {
        console.log(resp.data.data);
      })
      .catch(err => {
        // console.log(err.response.data);
        console.log(err);
      });
  });
};

let getCashTokenBalance = () => {
  return new Promise(resolve => {
    let payload = {
      userId: Number(number),
      accessToken: "ePIN"
    };

    axios
      .post(`${CELD.BASE_URL}/celdmobile/getCashTokenBalance`, payload, {
        headers: generateHeader(payload)
      })
      .then(resp => {
        console.log(resp);
      })
      .catch(err => {
        // console.log(err.response.data);
        console.log(err);
      });
  });
};

let requestPin = () => {
  return new Promise(resolve => {
    let payload = {
      data: {
        userPhoneNo: "08029150812"
      }
    };

    axios
      .post(`${CELD.BASE_URL}/celdmobile/loginWithPin`, payload, {
        headers: generateHeader(payload)
      })
      .then(resp => {
        console.log(resp);
      });
  });
};

authenticateUser();

//Use for test
let getEspiReport = (message, reportType) => {
  return axios.post(
    `${CELD.BASE_URL}/api/businesses/v1/${reportType}`,
    message,
    {
      headers: generateHeader(message)
    }
  );
};

module.exports = {};
