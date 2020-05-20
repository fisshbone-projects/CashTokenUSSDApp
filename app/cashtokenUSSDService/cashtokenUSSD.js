const { redisClient } = require("$config/redisConnectConfig");
const mongoFront = require("$libs/mongoLibs/mongoFront");
const moment = require("moment");
const {
  ActivateUser,
  NormalFlow,
  checkCachedWalletStatus,
  checkWalletStatus,
} = require("./ussd-entry-points");
const { APP_PREFIX_REDIS } = require("$utils");

async function CELDUSSD(sessionId, serviceCode, phoneNumber, text) {
  try {
    let response = await new Promise(async (resolve, reject) => {
      let walletStatus = await checkCachedWalletStatus(phoneNumber);

      if (walletStatus === null) {
        console.log("Getting walletStatus from ESPI newly ");
        let { status } = await checkWalletStatus(phoneNumber);
        walletStatus = status;
        if (status === "active") {
          redisClient.sadd(
            `${APP_PREFIX_REDIS}:activeWallets`,
            `${phoneNumber}`
          );
        } else if (status === "inactive") {
          redisClient.setex(
            `${APP_PREFIX_REDIS}:${phoneNumber}:inactive`,
            600,
            "inactive"
          );
        }
        // await redisClient.hset(
        //   `${APP_PREFIX_REDIS}:userWalletStatus`,
        //   `${phoneNumber}`,
        //   `${status}`
        // );
      } else {
        console.log("We got walletStatus from cached record");
      }

      redisClient
        .existsAsync(`${APP_PREFIX_REDIS}:${sessionId}`)
        .then(async (resp) => {
          if (resp === 0) {
            console.log("Creating new user session");

            let newDate = new Date();
            console.log(
              `New Hit: ${sessionId} at ${newDate.toDateString()} ${newDate
                .toTimeString()
                .substring(0, 8)}`
            );

            console.log(`Wallet Status for ${phoneNumber}: ${walletStatus}`);

            if (walletStatus === "inactive") {
              redisClient
                .hsetAsync(
                  `${APP_PREFIX_REDIS}:${sessionId}`,
                  "walletStatus",
                  "inactive"
                )
                .then(() => {
                  redisClient.expire(`${APP_PREFIX_REDIS}:${sessionId}`, 420); //Save the sessionID Temp details for 7 minutes
                });
              let response = await ActivateUser(phoneNumber, text, sessionId);
              resolve(response);
            } else if (walletStatus === "active") {
              redisClient
                .hmsetAsync(
                  `${APP_PREFIX_REDIS}:${sessionId}`,
                  "walletStatus",
                  "active"
                )
                .then(() => {
                  redisClient.expire(`${APP_PREFIX_REDIS}:${sessionId}`, 420); //Save the sessionID Temp details for 7 minutes
                });

              // Check if user exists in mongo
              let getUserId = await mongoFront.findUser(phoneNumber);
              if (getUserId) {
                redisClient.hmsetAsync(
                  `${APP_PREFIX_REDIS}:${sessionId}`,
                  "mongo_userId",
                  getUserId
                );
                mongoFront.updateUserLastActive(phoneNumber);
              } else {
                console.log(`Creating ${phoneNumber} in our user DB`);
                let userDoc = { phoneNumber, lastActive: Date.now() };
                let userId = await mongoFront.createUser(userDoc);
                redisClient.hmsetAsync(
                  `${APP_PREFIX_REDIS}:${sessionId}`,
                  "mongo_userId",
                  userId
                );
              }

              let response = await NormalFlow(phoneNumber, text, sessionId);
              resolve(response);
            } else {
              let response = `END Welcome to MyBankUSSD\nSorry, our service is temporarily unavailable.\nPlease try again.`;

              await redisClient.hdel(
                `${APP_PREFIX_REDIS}:userWalletStatus`,
                `${phoneNumber}`
              );

              resolve(response);
            }
          } else if (resp === 1) {
            console.log("Continuing an established session");
            redisClient
              .hgetallAsync(`${APP_PREFIX_REDIS}:${sessionId}`)
              .then(
                async ({ walletStatus: savedWalletStatus, mongo_userId }) => {
                  console.log(
                    `Continuing establised session with user ${savedWalletStatus}`
                  );
                  if (savedWalletStatus === "inactive") {
                    let response = await ActivateUser(
                      phoneNumber,
                      text,
                      sessionId
                    );
                    resolve(response);
                  } else if (savedWalletStatus === "active") {
                    if (!mongo_userId) {
                      // Check if user exists in mongo
                      let getUserId = await mongoFront.findUser(phoneNumber);
                      if (getUserId) {
                        redisClient.hmsetAsync(
                          `${APP_PREFIX_REDIS}:${sessionId}`,
                          "mongo_userId",
                          getUserId
                        );
                      } else {
                        console.log(`Creating ${phoneNumber} in our user DB`);
                        let userDoc = { phoneNumber, lastActive: Date.now() };
                        let userId = await mongoFront.createUser(userDoc);
                        redisClient.hmsetAsync(
                          `${APP_PREFIX_REDIS}:${sessionId}`,
                          "mongo_userId",
                          userId
                        );
                      }
                    }
                    let response = await NormalFlow(
                      phoneNumber,
                      text,
                      sessionId
                    );
                    resolve(response);
                  }
                }
              )
              .catch((err) => {
                console.log("An error occured:", err);
                resolve(
                  `CON A processing error has occured.\n\nEnter 0 to start over`
                );
              });
          }
        })
        .catch((err) => {
          console.log("An error occured:", err);
          resolve(
            `CON A processing error has occured.\n\nEnter 0 to start over`
          );
        });
    });

    await redisClient.incrAsync(
      `${APP_PREFIX_REDIS}:reports:count:global_totalTransactionalHits:${moment().format(
        "DMMYYYY"
      )}`
    );
    // expireReportsInRedis(
    //   `${APP_PREFIX_REDIS}:reports:count:global_totalTransactionalHits:${moment().format(
    //     "DMMYYYY"
    //   )}`
    // );
    await redisClient.saddAsync(
      `${APP_PREFIX_REDIS}:reports:set:global_totalVisitors:${moment().format(
        "DMMYYYY"
      )}`,
      phoneNumber
    );
    // expireReportsInRedis(
    //   `${APP_PREFIX_REDIS}:reports:set:global_totalVisitors:${moment().format(
    //     "DMMYYYY"
    //   )}`
    // );
    await redisClient.saddAsync(
      `${APP_PREFIX_REDIS}:reports:set:global_totalSessions:${moment().format(
        "DMMYYYY"
      )}`,
      sessionId
    );
    // expireReportsInRedis(
    //   `${APP_PREFIX_REDIS}:reports:set:global_totalSessions:${moment().format(
    //     "DMMYYYY"
    //   )}`
    // );

    return response;
  } catch (err) {
    console.log("An error occured:", err);
    resolve(`CON A processing error has occured.\n\nEnter 0 to start over`);
  }
}

module.exports = {
  CELDUSSD,
};
