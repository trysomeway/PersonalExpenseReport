function getApiKey(value) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const apiKey = scriptProperties.getProperty(value);

  if (!apiKey) {
    Logger.log(`API key ${value} is not set in Script Properties.`);
  }
  return apiKey;
}

var telegramBotToken = getApiKey("telegramBotToken");

var deploymentId = getApiKey("deploymentId");

var webAppUrl = `https://script.google.com/macros/s/${deploymentId}/exec`;

var spreadSheedId = getApiKey("spreadSheedId");

var locale = getApiKey("locale");

var timeZone = getApiKey("timeZone");


var telegramAdminID = getApiKey("telegramAdminID");

var telegramUrl = "https://api.telegram.org/bot" + telegramBotToken;

function getMe() {
  var url = telegramUrl + "/getMe";
  var response = UrlFetchApp.fetch(url);
  Logger.log(response.getContentText());
}

function setWebhook() {
  var url = telegramUrl + "/setWebhook?url=" + webAppUrl;
  var response = UrlFetchApp.fetch(url);
  Logger.log(response.getContentText());
}

function sendText(chatId, text, keyBoard) {
  var data = {
    method: "post",
    payload: {
      method: "sendMessage",
      chat_id: String(chatId),
      text: text,
      parse_mode: "HTML",
      reply_markup: JSON.stringify(keyBoard)
    }
  };
  UrlFetchApp.fetch('https://api.telegram.org/bot' + telegramBotToken + '/', data);
}

function deleteMessage(chatId, messageId) {
  var data = {
    method: "post",
    payload: {
      method: "deleteMessage",
      chat_id: String(chatId),
      message_id: String(messageId)
    }
  };
  UrlFetchApp.fetch('https://api.telegram.org/bot' + telegramBotToken + '/', data);
}

function debugMessage(e) {
  var data = JSON.parse(e.postData.contents);
  var id;
  if (data.callback_query) {
    id = data.callback_query.from.id;
  } else {
    id = data.message.chat.id;
  }
  sendText(id, "<pre>" + JSON.stringify(data) + "</pre>");
}

function logMessage(e) {
  var chatId = JSON.parse(e.postData.contents).message?.chat.id || JSON.parse(e.postData.contents).callback_query?.from.id;
  var cache = CacheService.getUserCache();
  var currentData = JSON.parse(cache.get(chatId) || "{}");
  currentData[new Date().getTime()] = e.postData.contents;
  cache.put(chatId, JSON.stringify(currentData), 3600);
}

function isNumber(n) {
  'use strict';
  n = n.replace(/\./g, '').replace(',', '.');
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function sendTotalExpensesList(id) {
  var expenseSheet = SpreadsheetApp.openById(spreadSheedId);
  var expenses = [];
  var dashboardSheet = expenseSheet.getSheetByName("Dashboard");
  var lr = dashboardSheet.getDataRange().getLastRow();
  for (var i = 2; i <= lr; i++) {
    var category = dashboardSheet.getRange(i, 1).getValue();
    var total = dashboardSheet.getRange(i, 2).getValue();
    if (total == "") continue;
    expenses.push("\n<b>" + category + "</b>:  kr " + Number(total).toFixed(2));
  }
  var expenseList = expenses.join("\n");
  sendText(id, decodeURI("<b>Here are your total expenses:</b> <span class=\"tg-spoiler\">%0A " + expenseList) + "\n\n--------------------\n" + "<b><u>💵 TOTAL: kr " + Number(dashboardSheet.getRange(1, 4).getValue()).toFixed(2) + "</u></b></span>");
  sendMainMenuKeyboard(id);
  CacheService.getUserCache().remove(id);
}

function addNewExpenseStep1Date(id) {
  var today = new Date();
  var yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  var twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  var keyBoard = {
    "inline_keyboard": [
      [
        {
          "text": "📅 Today - " + today.toLocaleDateString(locale, { timeZone: timeZone }),
          "callback_data": "newExpDate" + today.getTime()
        }
      ],
      [
        {
          "text": "📆 Yesterday - " + yesterday.toLocaleDateString(locale, { timeZone: timeZone }),
          "callback_data": "newExpDate" + yesterday.getTime()
        }
      ],
      [
        {
          "text": "🗓️ 2 Days Ago - " + twoDaysAgo.toLocaleDateString(locale, { timeZone: timeZone }),
          "callback_data": "newExpDate" + twoDaysAgo.getTime()
        }
      ]
    ]
  };
  sendText(id, "<b><u>🕰️ Choose the expense date:</u></b>", keyBoard);
}

function addNewExpenseStep2Category(id) {
  var expenseSheet = SpreadsheetApp.openById(spreadSheedId);
  var categoriesList = [];
  var categoriesSheet = expenseSheet.getSheetByName("Categories");
  var lr = categoriesSheet.getDataRange().getLastRow();
  for (var i = 2; i <= lr; i++) {
    var category = categoriesSheet.getRange(i, 1).getValue();
    categoriesList.push([
      {
        "text": category,
        "callback_data": "category" + category
      }
    ]);
  }
  var keyBoard = {
    "inline_keyboard": []
  };
  categoriesList.forEach(element => keyBoard["inline_keyboard"].push(element));
  sendText(id, "<b><u>📋 Choose the expense category:</u></b>", keyBoard);
}

function addNewExpenseStep3Currency(id) {
  var keyBoard = {
    "inline_keyboard": [
      [
        {
          "text": "🇬🇧 GBP",
          "callback_data": "currencyGBP"
        }
      ],
      [
        {
          "text": "🇺🇦 UAH",
          "callback_data": "currencyUAH"
        }
      ],
      [
        {
          "text": "🇸🇪 SEK",
          "callback_data": "currencySEK"
        }
      ]
    ]
  };
  sendText(id, "<b><u>💱 Choose the expense currency:</u></b>", keyBoard);
}


function addNewExpenseStep4Value(id) {
  sendText(id, "<b><u>💸 Write the expense value:</u></b>");
}

function addNewExpenseStep5Details(id) {
  var keyBoard = {
    "inline_keyboard": [
      [
        {
          "text": "N/A",
          "callback_data": "detailsNotAvailable"
        }
      ]
    ]
  };
  sendText(id, "<b><u>🕵 Write the expense details:</u></b>", keyBoard);
}

function sendMainMenuKeyboard(id) {
  var keyBoard = {
    "inline_keyboard": [
      [
        {
          "text": "⏮️ Total Expenses",
          "callback_data": "totalExpenses"
        }
      ],
      [
        {
          "text": "✍️ Add new expense",
          "callback_data": "addNewExpenseStep1Date"
        }
      ]
    ]
  };
  sendText(id, "What you want to do?", keyBoard);
}

function addExpenseToSpreadsheet(id) {
  try {
    var cache = CacheService.getUserCache();
    var userData = JSON.parse(cache.get(id) || "{}");
    var keys = Object.keys(userData).sort().slice(-5); // Get last 5 responses

    // New order: date, category, details, currency, value
    var date = JSON.parse(userData[keys[0]]).callback_query.data.slice("newExpDate".length);
    date = new Date(parseInt(date)).toLocaleDateString(locale, { timeZone: timeZone });

    var category = JSON.parse(userData[keys[1]]).callback_query.data.slice("category".length);

    // Details can be a message or a callback (if N/A)
    var detailsObj = JSON.parse(userData[keys[2]]);
    var details = detailsObj.callback_query ? "" : detailsObj.message.text.charAt(0).toUpperCase() + detailsObj.message.text.slice(1);

    var currency = JSON.parse(userData[keys[3]]).callback_query.data.slice("currency".length);

    var amount = parseFloat(JSON.parse(userData[keys[4]]).message.text.replace(/\s/g, "").replace(",", "."));

    var googleSheet = SpreadsheetApp.openById(spreadSheedId);
    var expensesSheet = googleSheet.getSheetByName("Expenses");
    var lr = expensesSheet.getDataRange().getLastRow();

    // Prepare the row data: [Date, Category, Currency, Amount, (Column 5 skipped), Details]
    var rowData = [[date, category, currency, amount, "", details]];
    expensesSheet.getRange(lr + 1, 1, 1, 6).setValues(rowData);

    sendText(id, "✔️ Expense added correctly!");
    sendTotalExpensesList(id);
    cache.remove(id);
  } catch (e) {
    sendText(id, "❌ An error occurred: " + e);
  }
}


function manageAddExpense(id) {
  var cache = CacheService.getUserCache();
  var userData = JSON.parse(cache.get(id) || "{}");
  var keys = Object.keys(userData).sort();
  if (keys.length < 4) return false;

  var fourthLastLog = JSON.parse(userData[keys[keys.length - 4]]);
  var thirdLastLog = JSON.parse(userData[keys[keys.length - 3]]);
  var secondLastLog = JSON.parse(userData[keys[keys.length - 2]]);
  var lastLog = JSON.parse(userData[keys[keys.length - 1]]);

  if (lastLog.callback_query && lastLog.callback_query.data.includes("category")) {
    // User chose category, prompt for details next
    addNewExpenseStep5Details(id);
    return true;
  } else if (lastLog.message && secondLastLog.callback_query && secondLastLog.callback_query.data.includes("category")) {
    // User wrote details, prompt for currency
    addNewExpenseStep3Currency(id);
    return true;
  } else if (lastLog.callback_query && lastLog.callback_query.data.includes("currency")) {
    // User chose currency, prompt for value
    sendText(id, "<b>💱 Currency: " + lastLog.callback_query.data.slice("currency".length) + "</b>");
    addNewExpenseStep4Value(id);
    return true;
  } else if (lastLog.message && secondLastLog.callback_query && secondLastLog.callback_query.data.includes("currency")) {
    // User wrote value, add to spreadsheet
    if (!isNumber(lastLog.message.text)) {
      sendText(id, "❌ An error occurred: value inserted is not valid! (" + lastLog.message.text + ")");
      return false;
    }
    addExpenseToSpreadsheet(id);
    return true;
  } else if (lastLog.callback_query && lastLog.callback_query.data == "detailsNotAvailable") {
    // User chose N/A for details, prompt for currency
    addNewExpenseStep3Currency(id);
    return true;
  }
  return false;
}

function checkUserAuthentication(id) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const usersString = scriptProperties.getProperty("authenticatedUsers");
  if (!usersString) {
    sendText(id, "⛔ No authenticated users configured!");
    return false;
  }
  // If stored as comma-separated string
  const users = usersString.split(",").map(u => u.trim());
  if (users.includes(String(id))) {
    return true;
  }
  sendText(id, "⛔ You're not authorized to interact with this bot!");
  return false;
}

function doPost(e) {
  logMessage(e);
  try {
    var contents = JSON.parse(e.postData.contents);
    if (contents.callback_query) {
      var id_callback = contents.callback_query.from.id;
      var data = contents.callback_query.data;
      if (!checkUserAuthentication(id_callback)) return;
      deleteMessage(id_callback, contents.callback_query.message.message_id);
      if (data == "totalExpenses") {
        sendTotalExpensesList(id_callback);
      } else if (data == "addNewExpenseStep1Date") {
        addNewExpenseStep1Date(id_callback);
      } else if (data.includes("newExpDate")) {
        var dateChosen = new Date(parseInt(data.slice("newExpDate".length)));
        dateChosen = dateChosen.toLocaleDateString(locale, { timeZone: timeZone });
        sendText(id_callback, "<b>🕰️ Date: " + dateChosen + "</b>");
        addNewExpenseStep2Category(id_callback);
      } else if (data.includes("category")) {
        sendText(id_callback, "<b>📋 Category: " + data.slice("category".length) + "</b>");
        addNewExpenseStep5Details(id_callback); // <-- Ask for details after category
      } else if (data == "detailsNotAvailable") {
        addNewExpenseStep3Currency(id_callback); // <-- If details N/A, ask for currency
      } else if (data.includes("currency")) {
        sendText(id_callback, "<b>💱 Currency: " + data.slice("currency".length) + "</b>");
        addNewExpenseStep4Value(id_callback);
      }
    } else if (contents.message) {
      var id_message = contents.message.chat.id;
      if (!checkUserAuthentication(id_message)) return;
      if (!manageAddExpense(id_message)) {
        sendMainMenuKeyboard(id_message);
      }
    }
  } catch (e) {
    sendText(telegramAdminID, JSON.stringify(e, null, 4));
  }
}