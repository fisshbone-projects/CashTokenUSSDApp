"use strict";
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const {
  checkValidationResult,
  createValidationFor,
  storeInternalLog,
  refineText,
  sanitizePhoneNumber,
} = require("./app/utils");
const { CELDUSSD } = require("./app/cashtokenUSSDService/cashtokenUSSD");
const {
  DIRECTDIALSERVICE,
} = require("./app/cashtokenUSSDDirectDial/directDialUtils");
const { processDirectDial } = require("./app/cashtokenUSSDDirectDial");
const { processUSSDRequests } = require("./app/airtelThanksUSSDAPI");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());

app.post("/v1/ussd", async (req, res) => {
  let { action, params, user } = req.body;

  if (action == undefined || params == undefined || user == undefined) {
    res.status(400).send("Error! Send the right payloads");
  }

  let response = await processUSSDRequests(action, params, user);
  res.json(response);
});

app.post(
  "/ussd",
  createValidationFor("ussd"),
  checkValidationResult,
  async (req, res) => {
    try {
      console.log(req.body);
      let response = "";
      let refinedText = await refineText(req.body.text, req.body.sessionId);
      let getDirectDialService = refinedText.substring(0, 2);
      let listOfDirectDialServices = Object.values(DIRECTDIALSERVICE);

      console.log("***REFINED TEXT IS: ", refinedText);

      switch (req.body.serviceCode) {
        case "*347*999#":
          // response = `END Hello!!! You have reached CashToken.\nOur systems are currently undergoing upgrades.\nServices will be restored shortly, please check back soon. `;

          // response = listOfDirectDialServices.includes(
          //   `${getDirectDialService}`
          // )
          //   ? await processDirectDial(
          //       req.body.sessionId,
          //       req.body.phoneNumber,
          //       refinedText
          //     )
          //   : await CELDUSSD(
          //       req.body.sessionId,
          //       req.body.serviceCode,
          //       sanitizePhoneNumber(req.body.phoneNumber),
          //       refinedText
          //     );

          response = await CELDUSSD(
            req.body.sessionId,
            req.body.serviceCode,
            sanitizePhoneNumber(req.body.phoneNumber),
            refinedText
          );
          break;
        case "*384*24222#":
          // response = `END Hello!!! You have reached CashToken.\nOur systems are currently undergoing upgrades.\nServices will be restored shortly, please check back soon. `;
          response = listOfDirectDialServices.includes(
            `${getDirectDialService}`
          )
            ? await processDirectDial(
                req.body.sessionId,
                req.body.phoneNumber,
                refinedText
              )
            : await CELDUSSD(
                req.body.sessionId,
                req.body.serviceCode,
                sanitizePhoneNumber(req.body.phoneNumber),
                refinedText
              );
          break;
        case "*384*24223#":
          response = listOfDirectDialServices.includes(
            `${getDirectDialService}`
          )
            ? await processDirectDial(
                req.body.sessionId,
                req.body.phoneNumber,
                refinedText
              )
            : await CELDUSSD(
                req.body.sessionId,
                req.body.serviceCode,
                sanitizePhoneNumber(req.body.phoneNumber),
                refinedText
              );
          break;
        default:
          response = "END Sorry, this service does not exist";
          break;
      }
      // await storeInternalLog(req, response, refinedText);
      return res.send(response);
    } catch (error) {
      console.error(error);
      return res.send(
        `CON A processing error has occured.\n\nEnter 0 Back to home menu`
      );
    }
  }
);

let port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("Express server listening on port " + port);
});
