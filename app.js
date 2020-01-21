"use strict";
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const {
  checkValidationResult,
  createValidationFor,
  storeInternalLog,
  refineText
} = require("./config/utils");
const { CELDUSSD } = require("./config/cashtokenUSSDService/cashtokenUSSD");
const { processUSSDRequests } = require("./config/airtelThanksUSSDAPI");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());

app.post("/v1/ussd", async (req, res) => {
  let { action, params, user } = req.body;

  if (action == undefined || params == undefined || user == undefined) {
    res.status(400).send("Please send the right payloads");
  }

  let response = await processUSSDRequests(action, params, user);
  res.json(response);
});

app.post(
  "/ussd",
  createValidationFor("ussd"),
  checkValidationResult,
  async (req, res) => {
    console.log(req.body);
    let response = "";
    let refinedText = refineText(req.body.text);

    console.log("***REFINED TEXT IS: ", refinedText);

    switch (req.body.serviceCode) {
      case "*347*999#":
        response = await CELDUSSD(
          req.body.sessionId,
          req.body.serviceCode,
          req.body.phoneNumber,
          refinedText
        );
        break;
      case "*384*24222#":
        response = await CELDUSSD(
          req.body.sessionId,
          req.body.serviceCode,
          req.body.phoneNumber,
          refinedText
        );
        break;
      case "*384*24223#":
        response = await CELDUSSD(
          req.body.sessionId,
          req.body.serviceCode,
          req.body.phoneNumber,
          refinedText
        );
        break;
      default:
        response = "END Sorry, this service does not exist";
        break;
    }
    await storeInternalLog(req, response, refinedText);
    return res.send(response);
  }
);

let port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("Express server listening on port " + port);
});
