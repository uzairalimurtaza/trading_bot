import axios from "axios";
import AccountModel from "../models/account.model.js";
import StrategyModel from "../models/strategy.model.js";
import InstanceModel from "../models/instances.model.js";

// ToDo : remove all extra logs , is docker running or not , etc

export const addPMMSimpleConfig = async (req, res) => {
  try {
    const { name, version, content } = req.body;

    if (!name || !version || !content) {
      return res.status(400).json({
        success: false,
        message: "Missing name , version or content in request body",
      });
    }
    let _name = name.toLowerCase();
    const userId = req.user.id;
    const nameVersion = `${_name}_${version}`;
    const nameVersionUserId = `${userId}_${_name}_${version}`;

    /*take_profit_order_type: limit(2), market(1);
      leverage (1 for spot trading)
      candles_config: [] here its empty coz its simple pmm strategy 
      position_mode here we have used it static coz its related to future trading and currently we are doing spot trading*/

    const baseContent = {
      id: nameVersionUserId,
      controller_name: "pmm_simple",
      controller_type: "market_making",
      manual_kill_switch: false,
      leverage: 1,
      candles_config: [],
      position_mode: "HEDGE",
      ...content,
    };

    const configContent = JSON.parse(JSON.stringify(baseContent));
    const processedContent = JSON.parse(JSON.stringify(baseContent));

    // Convert percentages to decimals
    processedContent.buy_spreads = processedContent.buy_spreads.map(
      (v) => v / 100
    );
    processedContent.sell_spreads = processedContent.sell_spreads.map(
      (v) => v / 100
    );
    processedContent.stop_loss = processedContent.stop_loss / 100;
    processedContent.take_profit = processedContent.take_profit / 100;
    processedContent.trailing_stop.activation_price =
      processedContent.trailing_stop.activation_price / 100;
    processedContent.trailing_stop.trailing_delta =
      processedContent.trailing_stop.trailing_delta / 100;

    // Normalize buy and sell amounts
    const normalize = (arr) => {
      const sum = arr.reduce((acc, val) => acc + val, 0);
      return arr.map((val) => val / sum);
    };

    const combinedAmounts = [
      ...processedContent.buy_amounts_pct,
      ...processedContent.sell_amounts_pct,
    ];
    const normalizedCombined = normalize(combinedAmounts);

    const buyLength = processedContent.buy_amounts_pct.length;
    processedContent.buy_amounts_pct = normalizedCombined.slice(0, buyLength);
    processedContent.sell_amounts_pct = normalizedCombined.slice(buyLength);

    processedContent.executor_refresh_time =
      processedContent.executor_refresh_time * 60;
    processedContent.cooldown_time = processedContent.cooldown_time * 60;
    processedContent.time_limit = processedContent.time_limit * 60;
    console.log(processedContent);

    const payload = {
      name: nameVersionUserId,
      content: processedContent,
    };

    const hummingUrl = `${process.env.HUMMING_BOT_API_BASE_URL}/add-controller-config`;

    try {
      const response = await axios.post(hummingUrl, payload, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        auth: {
          username: process.env.HUMMING_BOT_USERNAME,
          password: process.env.HUMMING_BOT_PASSWORD,
        },
      });
    } catch (error) {
      const err =
        error.response?.data?.detail || "Failed to add controller config.";
      const status = error.response?.status || 500;
      return res.status(status).json({
        success: false,
        message: err,
      });
    }

    await StrategyModel.findOneAndUpdate(
      { strategyFileUniqueName: nameVersionUserId },
      {
        userId,
        strategyFileName: nameVersion,
        strategyFileUniqueName: nameVersionUserId,
        controllerName: processedContent.controller_name,
        controllerType: processedContent.controller_type,
        config: configContent,
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Controller config added successfully",
    });
  } catch (err) {
    console.error("Error in adding PMMSimple Config : ", err);
    return res.status(500).json({
      success: false,
      message: "Error uploading PMMSimple config file .",
    });
  }
};

export const getUserStrategyFileNames = async (req, res) => {
  try {
    const userId = req.user.id;
    const strategies = await StrategyModel.find({ userId }).select(
      "strategyFileName -_id"
    );
    const fileNames = strategies.map((s) => s.strategyFileName);

    return res.status(200).json({
      success: true,
      strategyFileNames: fileNames,
    });
  } catch (err) {
    console.error("Error fetching strategy file names:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching strategy file names",
    });
  }
};

export const getUserStrategies = async (req, res) => {
  try {
    const userId = req.user.id;

    const strategies = await StrategyModel.find({ userId }).select(
      "strategyFileName config"
    );

    const formatted = {};
    strategies.forEach((strategy) => {
      const config = strategy.config;

      const {
        controller_name,
        controller_type,
        connector_name,
        trading_pair,
        total_amount_quote,
        buy_spreads,
        sell_spreads,
        buy_amounts_pct,
        sell_amounts_pct,
        executor_refresh_time,
        cooldown_time,
        stop_loss,
        take_profit,
        time_limit,
        take_profit_order_type,
        trailing_stop,
      } = config;

      const max_loss = (total_amount_quote * (stop_loss / 100)) / 2;

      formatted[strategy.strategyFileName] = {
        controller_name,
        controller_type,
        connector_name,
        trading_pair,
        total_amount_quote,
        buy_spreads,
        sell_spreads,
        buy_amounts_pct,
        sell_amounts_pct,
        executor_refresh_time,
        cooldown_time,
        stop_loss,
        take_profit,
        time_limit,
        take_profit_order_type,
        trailing_stop,
        max_loss,
      };
    });

    return res.status(200).json({
      success: true,
      strategies: formatted,
    });
  } catch (err) {
    console.error("Error fetching user strategies:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch strategies",
    });
  }
};

export const deleteStorageFiles = async (req, res) => {
  try {
    const userId = req.user.id;

    const { strategyFileNames } = req.body;

    if (!Array.isArray(strategyFileNames) || strategyFileNames.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Incorrect or missing strategyFileNames in request body",
      });
    }

    const strategies = await StrategyModel.find({
      userId,
      strategyFileName: { $in: strategyFileNames },
    });
    if (!strategies || strategies.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No matching strategy files found for the user.",
      });
    }

    let deletedCount = 0;

    for (const strategy of strategies) {
      const uniqueName = strategy.strategyFileUniqueName;
      const hummingUrl = `${process.env.HUMMING_BOT_API_BASE_URL}/delete-controller-config?config_name=${uniqueName}.yml`;

      try {
        await axios.post(hummingUrl, null, {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          auth: {
            username: process.env.HUMMING_BOT_USERNAME,
            password: process.env.HUMMING_BOT_PASSWORD,
          },
        });

        await StrategyModel.deleteOne({ _id: strategy._id });
        deletedCount++;
        console.log(`✅ Deleted config: ${uniqueName}`);
      } catch (error) {
        const errMsg =
          error.response?.data?.detail || "Failed to delete controller config.";
        const statusCode = error.response?.status || 500;

        return res.status(statusCode).json({
          success: false,
          message: `Error deleting config "${uniqueName}": ${errMsg}`,
          deleted: deletedCount,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Strategies deleted successfully",
      deleted: deletedCount,
    });
  } catch (err) {
    console.error("❌ Error during bulk delete:", err);
    return res.status(500).json({
      success: false,
      message: "Bulk delete failed",
    });
  }
};

export const launchBot = async (req, res) => {
  try {
    const {
      botName,
      credentials,
      controllerConfigs,
      globalDrawdown,
      controllerDrawdown,
      rebalanceInterval,
      assetToRebalance,
    } = req.body;

    const userId = req.user.id;

    if (
      !botName ||
      !credentials ||
      !Array.isArray(controllerConfigs) ||
      controllerConfigs.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }
    const existingBot = await InstanceModel.findOne({ userId, name: botName });
    if (existingBot) {
      return res.status(400).json({
        success: false,
        message: `Bot with name "${botName}" already exists for this user.`,
      });
    }
    // Step 1: Build instanceName
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:.]/g, "")
      .slice(0, 12);
    const instanceName = `${botName}-${userId}-${timestamp}`;
    const instanceUniqueName = `hummingbot-${instanceName}`;

    // Step 2: Get uniqueAccountName from DB
    const account = await AccountModel.findOne({
      userId,
      accountName: credentials,
    });
    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }
    const uniqueAccountName = account.uniqueAccountName;

    // Step 3: Fetch unique controller config names from DB
    const finalControllerConfigs = [];

    for (const configName of controllerConfigs) {
      // Extract controllerName and version from string like "samWatson_0.2"

      const strategy = await StrategyModel.findOne({
        userId,
        strategyFileName: configName,
      });

      if (!strategy) {
        return res.status(404).json({
          success: false,
          message: `Strategy config "${configName}" not found for user.`,
        });
      }

      finalControllerConfigs.push(`${strategy.strategyFileUniqueName}.yml`);
    }

    // ✅ Don't stringify the array — send it as is
    console.log(finalControllerConfigs);
    // Step 4: Build script config
    const scriptConfig = {
      name: instanceName,
      content: {
        script_file_name: "v2_with_controllers.py",
        controllers_config: finalControllerConfigs,
        markets: {},
        candles_config: [],
        time_to_cash_out: null,
      },
    };

    if (globalDrawdown)
      scriptConfig.content.max_global_drawdown = globalDrawdown;

    if (controllerDrawdown)
      scriptConfig.content.max_controller_drawdown = controllerDrawdown;

    if (rebalanceInterval) {
      if (!assetToRebalance || !assetToRebalance.includes("USD")) {
        return res.status(400).json({
          success: false,
          message: "Asset to rebalance must be USD-based",
        });
      }
      scriptConfig.content.rebalance_interval = rebalanceInterval;
      scriptConfig.content.asset_to_rebalance = assetToRebalance;
    }

    // Helper to post to Hummingbot API
    const callHummingbotAPI = async (endpoint, data = null) => {
      const url = `${process.env.HUMMING_BOT_API_BASE_URL}/${endpoint}`;
      return axios.post(url, data, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        auth: {
          username: process.env.HUMMING_BOT_USERNAME,
          password: process.env.HUMMING_BOT_PASSWORD,
        },
      });
    };

    // Step 5: Delete existing script configs
    try {
      await callHummingbotAPI("delete-all-script-configs");
      console.log("✅ Deleted all existing script configs.");
    } catch (error) {
      const msg =
        error.response?.data?.detail || "Failed to delete script configs.";
      return res.status(error.response?.status || 500).json({
        success: false,
        message: msg,
      });
    }

    // Step 6: Add new script config
    try {
      await callHummingbotAPI("add-script-config", scriptConfig);
      console.log("✅ Added new script config:", scriptConfig);
    } catch (error) {
      let msg = error.response?.data?.detail || "Failed to add script config.";
      if (msg == "Not Found") {
        msg = "Strategy file not found.";
      }
      return res.status(error.response?.status || 500).json({
        success: false,
        message: msg,
      });
    }

    // Step 7: Launch bot
    const deployConfig = {
      instance_name: instanceName,
      script: "v2_with_controllers.py",
      script_config: `${instanceName}.yml`,
      image: "hummingbot/hummingbot:latest",
      credentials_profile: uniqueAccountName,
    };

    try {
      await callHummingbotAPI("create-hummingbot-instance", deployConfig);
      console.log("✅ Bot instance launched:", deployConfig);
    } catch (error) {
      const msg =
        error.response?.data?.detail || "Failed to launch bot instance.";
      return res.status(error.response?.status || 500).json({
        success: false,
        message: msg,
      });
    }

    // Step 8: Save to DB
    await InstanceModel.create({
      userId,
      name: botName,
      uniqueName: instanceUniqueName,
      activeControllers: controllerConfigs,
    });

    return res.status(200).json({
      success: true,
      message: "Bot launched successfully.",
      botName: botName,
    });
  } catch (err) {
    console.error("Launch bot error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Unexpected error while launching the bot.",
    });
  }
};

function formatCloseTypes(closeTypes) {
  const tp = closeTypes["CloseType.TAKE_PROFIT"] || 0;
  const sl = closeTypes["CloseType.STOP_LOSS"] || 0;
  const ts = closeTypes["CloseType.TRAILING_STOP"] || 0;
  const tl = closeTypes["CloseType.TIME_LIMIT"] || 0;
  const es = closeTypes["CloseType.EARLY_STOP"] || 0;
  const f = closeTypes["CloseType.FAILED"] || 0;

  return `TP: ${tp} | SL: ${sl} | TS: ${ts} | TL: ${tl} | ES: ${es} | F: ${f}`;
}
//  Active controllers  → " Active Controllers" table.
//  Stopped controllers → " Stopped Controllers" table.
//  Error controllers   → " Controllers with errors" table.

export const getUserBotStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(userId);

    const bots = await InstanceModel.find({ userId: userId });
    console.log(bots);
    const results = [];

    for (const bot of bots) {
      const botName = bot.uniqueName;
      const botStatusUrl = `${process.env.HUMMING_BOT_API_BASE_URL}/get-bot-status/${botName}`;

      let status;
      let botData = null;

      try {
        const response = await axios.get(botStatusUrl, {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          auth: {
            username: process.env.HUMMING_BOT_USERNAME,
            password: process.env.HUMMING_BOT_PASSWORD,
          },
        });

        botData = response.data?.data || {};
        status = botData.status || "Error";
      } catch (error) {
        const errMsg =
          error.response?.data?.detail ||
          "An error occurred while fetching bot status";
        results.push({
          botName: bot.name,
          status:
            error.response?.data?.detail === "Bot not found"
              ? "Stopped"
              : "Error",
          activeControllers: [],
          stoppedControllers: [],
          error: errMsg,
        });
        continue;
      }
      const errorLogs = botData?.error_logs || [];
      const generalLogs = botData?.general_logs || [];

      const latestErrorLogs = errorLogs.slice(-50); // last 50 logs
      const latestGeneralLogs = generalLogs.slice(-50); // last 50 logs
      const performance = botData.performance || {};
      console.log(performance);
      const controllerNames = Object.keys(performance);
      console.log("Controller Names: ", controllerNames);
      const strategyConfigs = await StrategyModel.find({
        strategyFileUniqueName: { $in: controllerNames },
        userId: bot.userId,
      });
      console.log("Strategy Configs: ", strategyConfigs);
      const activeControllers = [];
      const stoppedControllers = [];
      let totalNetPNL = 0;
      let totalVolumeTraded = 0;
      let totalOpenOrderVolume = 0;
      let totalImbalance = 0;
      let totalUnrealizedPNL = 0;
      for (const controllerId of controllerNames) {
        console.log(controllerId);
        const perf = performance[controllerId];
        console.log("Performance: ", perf);
        if (perf.status === "error")
          // add this controller to error controllers
          continue;

        const matchedStrategy = strategyConfigs.find(
          (s) => s.strategyFileUniqueName === controllerId
        );

        const config = matchedStrategy?.config || {};
        const fileName = matchedStrategy?.strategyFileName || "N/A";

        const p = perf.performance || {};
        const realized_pnl = p.realized_pnl_quote || 0;
        const unrealized_pnl = p.unrealized_pnl_quote || 0;
        const net_pnl = p.global_pnl_quote || 0;
        const volume_traded = p.volume_traded || 0;
        const open_order_volume = p.open_order_volume || 0;
        const imbalance = p.inventory_imbalance || 0;

        const controllerData = {
          name: fileName,
          controller: config.controller_name || "N/A",
          connector: config.connector_name || "N/A",
          trading_pair: config.trading_pair || "N/A",
          realized_pnl: Number(realized_pnl.toFixed(2)),
          unrealized_pnl: Number(unrealized_pnl.toFixed(2)),
          net_pnl: Number(net_pnl.toFixed(2)),
          volume_traded: Number(volume_traded.toFixed(2)),
          open_order_volume: Number(open_order_volume.toFixed(2)),
          imbalance: Number(imbalance.toFixed(2)),
          close_types: formatCloseTypes(p.close_type_counts || {}),
        };
        if (bot.stoppedControllers.includes(fileName)) {
          stoppedControllers.push(controllerData);
        } else {
          activeControllers.push(controllerData);
        }

        totalNetPNL += net_pnl;
        totalVolumeTraded += volume_traded;
        totalOpenOrderVolume += open_order_volume;
        totalImbalance += imbalance;
        totalUnrealizedPNL += unrealized_pnl;
      }
      const totalNetPNLPercentage =
        totalVolumeTraded > 0
          ? Number(((totalNetPNL / totalVolumeTraded) * 100).toFixed(2))
          : 0;

      results.push({
        botName: bot.name,
        status,
        activeControllers,
        stoppedControllers,
        totalNetPNL: Number(totalNetPNL.toFixed(2)),
        totalNetPNLPercentage,
        totalVolumeTraded: Number(totalVolumeTraded.toFixed(2)),
        totalOpenOrderVolume: Number(totalOpenOrderVolume.toFixed(2)),
        totalImbalance: Number(totalImbalance.toFixed(2)),
        totalUnrealizedPNL: Number(totalUnrealizedPNL.toFixed(2)),
        errorLogs: latestErrorLogs,
        generalLogs: latestGeneralLogs,
      });
    }

    return res.json({ success: true, data: results });
  } catch (error) {
    console.error("Error fetching bot statuses:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const stopActiveStrategyFile = async (req, res) => {
  const { botName, fileName } = req.body;
  try {
    const userId = req.user.id;
    console.log(userId);

    const bot = await InstanceModel.findOne({ userId: userId, name: botName });
    if (!bot) {
      return res.status(404).json({
        success: false,
        message: `Bot "${botName}" not found for user.`,
      });
    }
    const strategyConfig = await StrategyModel.findOne({
      userId: userId,
      strategyFileName: fileName,
    });
    if (!strategyConfig) {
      return res.status(404).json({
        success: false,
        message: `Strategy file "${fileName}" not found.`,
      });
    }
    const botUniqueName = bot.uniqueName;
    const strategyFileUniqueName = strategyConfig.strategyFileUniqueName;
    const hummingUrl = `${process.env.HUMMING_BOT_API_BASE_URL}/update-controller-config/bot/${botUniqueName}/${strategyFileUniqueName}`;
    const payload = { manual_kill_switch: true };

    try {
      await axios.put(hummingUrl, payload, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        auth: {
          username: process.env.HUMMING_BOT_USERNAME,
          password: process.env.HUMMING_BOT_PASSWORD,
        },
      });
    } catch (error) {
      const errMsg =
        error.response?.data?.detail ||
        "Failed to stop active controller config.";
      const status = error.response?.status || 500;
      console.error("Hummingbot stopping strategy file API error:", errMsg);
      return res.status(status).json({
        success: false,
        message: errMsg,
      });
    }

    bot.activeControllers = bot.activeControllers.filter(
      (controller) => controller !== fileName
    );
    if (!bot.stoppedControllers.includes(fileName)) {
      bot.stoppedControllers.push(fileName);
    }

    await bot.save();
    return res.status(200).json({
      success: true,
      message: "Strategy file stopped successfully.",
    });
  } catch (error) {
    console.error(
      "Unexpected server error while stopping strategy file :",
      err.message
    );
    return res.status(500).json({
      success: false,
      message: "Unexpected error while stopping strategy file.",
    });
  }
};
