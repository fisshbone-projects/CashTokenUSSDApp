let axios = require("axios");
let { INFOBIP } = require("./index");
// const KEY = btoa(`${INFOBIP.USERNAME}:${INFOBIP.PASSWORD}`);

const headers = {
  Accept: "application/json",
  "Content-Type": "application/json",
  Authorization: "App " + INFOBIP.API_KEY
};

async function sendSMS(phoneNumber, messageText) {
  return new Promise(resolve => {
    console.log(`Sending bankUSSD sms to ${phoneNumber}`);
    axios
      .post(
        `${INFOBIP.BASE_URL}/sms/2/text/single`,
        {
          from: "CashToken",

          to: `${phoneNumber}`,
          text: `${messageText}`
        },
        {
          withCredentials: true,
          headers
        }
      )
      .then(resp => {
        console.log(JSON.stringify(resp.data, null, 2));
        resolve();
      })
      .catch(err => {
        console.log(
          `An error occured while sending bankUSSD sms to ${phoneNumber}`
        );
        console.log(err);
        resolve();
      });
  });
}

module.exports = {
  sendSMS
};
