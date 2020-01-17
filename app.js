"use strict";
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { check, validationResult, sanitize } = require("express-validator");
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

app.post("/ussd", async (req, res) => {
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
    default:
      response = "END Sorry, this service does not exist";
      break;
  }

  res.send(response);
});

//Testing out Express Validator
app.post(
  "/validate",
  createValidationFor("validate"),
  checkValidationResult,
  (req, res) => {
    console.log(req.body.name);
    console.log(req.body.email);
    res.send("You have valid inputs Weldone!");
  }
);

function createValidationFor(route) {
  switch (route) {
    case "validate":
      return [check("name").isLength({ min: 3 }), check("email").isEmail()];
    default:
      return [];
  }
}

function checkValidationResult(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) {
    return next();
  }

  res.status(422).json({ error: result.array() });
}

let port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("Express server listening on port " + port);
});

function refineText(text) {
  let splittedText = text.split("*");
  let newText = "";
  let backToMainMenu = false;
  let backToMainMenuIndex = 0;
  let backOneStep = false;
  let backOneStepIndex = 0;

  for (let i = splittedText.length - 1; i > 0; i--) {
    if (splittedText[i] === "0") {
      backToMainMenu = true;
      backToMainMenuIndex = i;
      break;
    } else if (splittedText[i] === "#") {
      backOneStep = true;
      backOneStepIndex = i;
      break;
    }
  }

  if (backToMainMenu) {
    if (splittedText[backToMainMenuIndex + 1] === undefined) {
      newText = "";
    } else {
      let newSplitArray = splittedText.splice(backToMainMenuIndex + 1);
      newText = newSplitArray.join("*");
    }
  } else if (backOneStep) {
    if (splittedText[backOneStepIndex + 1] === undefined) {
      let newSplitArray = splittedText.filter(value => {
        return value !== "#";
      });
      console.log(newSplitArray);

      let finalSplitArray = newSplitArray.slice();
      for (let i = 0; i < newSplitArray.length; i++) {
        console.log("I'm popping");
        finalSplitArray.pop();
      }
      newText = finalSplitArray.join("*");
    } else {
      let newSplitArray = splittedText.splice(backOneStepIndex + 1);
      newText = newSplitArray.join("*");
    }
  } else {
    newText = text;
  }
  return newText;
}
