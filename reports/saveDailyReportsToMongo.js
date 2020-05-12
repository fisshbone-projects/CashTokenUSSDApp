const mongo = require("../config/mongodbConfig");
const {
  DailyReportModel: DailyReport,
} = require("../config/mongoModels/index");
const { redisClient } = require("../config/redisConnectConfig");
const {
  APP_PREFIX_REDIS,
  formatNumber,
  globalKeyMap,
  camelize,
  purchasesKeyMap,
  subMenuKeyMap,
  topMenuKeyMap,
  purchasesTotalValueKeyMap,
} = require("../utils");
const moment = require("moment");

// let reportDate = moment().subtract(1, "day").format("DMMYYYY");

// (async () => {
//   for (i = 1; i <= 30; i++) {
//     let reportDate = `${i}042020`;
//     await saveReportToMongo(reportDate);
//   }

//   process.exit(9);
// })();

async function saveReportToMongo(reportDate) {
  return new Promise(async (resolve) => {
    let keyPattern = `${APP_PREFIX_REDIS}:reports*:${reportDate}`;
    console.log(keyPattern);
    let listOfKeys = await redisClient.keysAsync(keyPattern);

    let globalKeys = listOfKeys.filter((value) => {
      return value.includes("global");
    });
    let topMenuKeys = listOfKeys.filter((value) => {
      return value.includes("topMenu");
    });
    let subMenuKeys = listOfKeys.filter((value) => {
      return value.includes("subMenu");
    });
    let purchasesKeys = listOfKeys.filter((value) => {
      return value.includes("purchases");
    });
    let purchasesTotalValueKeys = listOfKeys.filter((value) => {
      return value.includes("totalValue");
    });

    let globalReports = await getUSSDReport(globalKeys, globalKeyMap);
    let topMenuReports = await getUSSDReport(topMenuKeys, topMenuKeyMap);
    let submenuReports = await getUSSDReport(subMenuKeys, subMenuKeyMap);
    let purchasesReports = await getUSSDReport(purchasesKeys, purchasesKeyMap);
    let purchasesTotalValueReports = await getUSSDReport(
      purchasesTotalValueKeys,
      purchasesTotalValueKeyMap
    );

    let totalPurchasesReports = mergePurchasesReports(
      purchasesReports,
      purchasesTotalValueReports
    );

    let mongoReport = {
      reportDate,
    };
    mongoReport.generalLogs = globalReports;
    mongoReport.topMenuHitLogs = topMenuReports;
    mongoReport.subMenuHitLogs = submenuReports;
    mongoReport.purchasesLogs = totalPurchasesReports;

    console.log(mongoReport);

    DailyReport.create(mongoReport, (resp) => {
      console.log(resp);
      console.log("Report successfully Saved to Mongo");
      resolve();
    });
  });
}

function mergePurchasesReports(purchaseReport, totalAmountReport) {
  let refinedReport = {};

  for (value of Object.keys(purchaseReport)) {
    refinedReport[`${value}`] = {
      totalCount: purchaseReport[value],
      totalAmount: totalAmountReport[value] ? totalAmountReport[value] : 0,
    };
  }

  return refinedReport;
}

async function getUSSDReport(keyType, keyTypeMap) {
  return new Promise(async (resolve) => {
    try {
      let reportValues = {};

      for (let value of keyType) {
        if (value.includes("set") && !value.includes("Reset")) {
          let setResult = await redisClient.scardAsync(value);
          for (key of Object.keys(keyTypeMap)) {
            if (value.includes(key)) {
              let name = keyTypeMap[key];
              name = name.replace("/", "");
              reportValues[`${camelize(name)}`] = setResult;
            }
          }
        } else if (value.includes("count")) {
          let setResult = await redisClient.getAsync(value);
          for (key of Object.keys(keyTypeMap)) {
            if (value.includes(key)) {
              let name = keyTypeMap[key];
              name = name.replace("/", "");
              reportValues[`${camelize(name)}`] = setResult;
            }
          }
        }
      }
      resolve(reportValues);
    } catch (error) {
      console.error(error);
    }
  });
}

module.exports = {
  saveReportToMongo,
};
