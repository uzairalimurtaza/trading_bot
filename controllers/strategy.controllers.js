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

export const getUserBotStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(userId);
    // Step 1: Get all bots for this user
    const bots = await InstanceModel.find({ userId: userId });
    console.log(bots);
    const results = [];

    for (const bot of bots) {
      const botName = bot.uniqueName;
      const botStatusUrl = `${process.env.HUMMING_BOT_API_BASE_URL}/get-bot-status/${botName}`;

      let status = "unknown";
      let botData = null;

      // Step 2: Call Hummingbot API to get status
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

        status = response.data?.data?.status || "unknown";
        botData = response.data?.data;
      } catch (error) {
        results.push({
          botName: bot.name,
          status: "error",
          activeControllers: [],
          error: error.response?.data?.detail || "Failed to fetch bot status.",
        });
        continue;
      }

      // Step 3: Match activeControllers with StrategyModel
      const controllerNames = bot.activeControllers || [];

      const strategyConfigs = await StrategyModel.find({
        strategyFileName: { $in: controllerNames },
        userId: bot.userId,
      });

      const activeControllers = controllerNames.map((controllerId) => {
        const matched = strategyConfigs.find(
          (s) => s.strategyFileName === controllerId
        );

        return {
          name: controllerId,
          controller: matched?.config?.controller_name || "N/A",
          connector: matched?.config?.connector_name || "N/A",
          trading_pair: matched?.config?.trading_pair || "N/A",
          realized_pnl: 0,
          unrealized_pnl: 0,
          net_pnl: 0,
          volume_traded: 0,
          open_order_volume: 0,
          imbalance: 0,
        };
      });

      results.push({
        botName: bot.name,
        status,
        activeControllers,
        totalNetPNL: 0,
        totalNetPNLPercentage: 0,
        totalVolumeTraded: 0,
        totalOpenOrderVolume: 0,
        totalImbalance: 0,
        totalUnrealizedPNL: 0,
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

// export const getBotControllersSummary = async (req, res) => {
//   const botName = req.params.botName;

//   try {
//     const controllerConfigs = (await getAllConfigsFromBot(botName)) || [];
//     const botStatus = await getBotStatus(botName);

//     if (!botStatus || botStatus.status === "error") {
//       return res.status(500).json({
//         status: "error",
//         message: `Failed to fetch status for bot ${botName}`,
//         errorLogs: botStatus?.data?.error_logs || [],
//       });
//     }

//     const botData = botStatus.data;
//     const isRunning = botData.status === "running";
//     const performance = botData.performance || {};
//     const errorLogs = botData.error_logs || [];
//     const generalLogs = botData.general_logs || [];

//     const activeControllers = [];
//     const stoppedControllers = [];
//     const errorControllers = [];

//     let totalGlobalPNL = 0;
//     let totalVolumeTraded = 0;
//     let totalOpenOrderVolume = 0;
//     let totalImbalance = 0;
//     let totalUnrealizedPNL = 0;

//     for (const controllerId in performance) {
//       const entry = performance[controllerId];
//       const controllerStatus = entry.status;

//       if (controllerStatus === "error") {
//         errorControllers.push({ id: controllerId, error: entry.error });
//         continue;
//       }

//       const perf = entry.performance || {};
//       const config = controllerConfigs.find((c) => c.id === controllerId) || {};

//       const killSwitch = config.manual_kill_switch === true;
//       const closeTypes = perf.close_type_counts || {};

//       const controllerInfo = {
//         id: controllerId,
//         controller: config.controller_name || controllerId,
//         connector: config.connector_name || "NaN",
//         trading_pair: config.trading_pair || "NaN",
//         realized_pnl_quote: parseFloat(perf.realized_pnl_quote || 0).toFixed(2),
//         unrealized_pnl_quote: parseFloat(
//           perf.unrealized_pnl_quote || 0
//         ).toFixed(2),
//         global_pnl_quote: parseFloat(perf.global_pnl_quote || 0).toFixed(2),
//         volume_traded: parseFloat(perf.volume_traded || 0).toFixed(2),
//         open_order_volume: parseFloat(perf.open_order_volume || 0).toFixed(2),
//         imbalance: parseFloat(perf.inventory_imbalance || 0).toFixed(2),
//         close_types: `TP: ${closeTypes["CloseType.TAKE_PROFIT"] || 0} | SL: ${
//           closeTypes["CloseType.STOP_LOSS"] || 0
//         } | TS: ${closeTypes["CloseType.TRAILING_STOP"] || 0} | TL: ${
//           closeTypes["CloseType.TIME_LIMIT"] || 0
//         } | ES: ${closeTypes["CloseType.EARLY_STOP"] || 0} | F: ${
//           closeTypes["CloseType.FAILED"] || 0
//         }`,
//       };

//       if (killSwitch) stoppedControllers.push(controllerInfo);
//       else activeControllers.push(controllerInfo);

//       totalGlobalPNL += parseFloat(perf.global_pnl_quote || 0);
//       totalVolumeTraded += parseFloat(perf.volume_traded || 0);
//       totalOpenOrderVolume += parseFloat(perf.open_order_volume || 0);
//       totalImbalance += parseFloat(perf.inventory_imbalance || 0);
//       totalUnrealizedPNL += parseFloat(perf.unrealized_pnl_quote || 0);
//     }

//     const totalGlobalPNLPercentage =
//       totalVolumeTraded > 0 ? totalGlobalPNL / totalVolumeTraded : 0;

//     return res.json({
//       status: isRunning ? "running" : "stopped",
//       activeControllers,
//       stoppedControllers,
//       errorControllers,
//       totalGlobalPNL: totalGlobalPNL.toFixed(3),
//       totalGlobalPNLPercentage: (totalGlobalPNLPercentage * 100).toFixed(2),
//       totalVolumeTraded: totalVolumeTraded.toFixed(2),
//       totalOpenOrderVolume: totalOpenOrderVolume.toFixed(2),
//       totalImbalance: totalImbalance.toFixed(2),
//       totalUnrealizedPNL: totalUnrealizedPNL.toFixed(2),
//       errorLogs,
//       generalLogs,
//     });
//   } catch (err) {
//     console.error("Error in getBotControllersSummary:", err.message);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch bot controller summary.",
//     });
//   }
// };
