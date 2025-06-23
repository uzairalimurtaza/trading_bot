import axios from "axios";
import StrategyModel from "../models/strategy.model.js";

// ToDo : remove all extra logs

export const addPMMSimpleConfig = async (req, res) => {
  try {
    const { name, version, content } = req.body;

    if (!name || !version || !content) {
      return res.status(400).json({
        success: false,
        message: "Missing name , version or content in request body",
      });
    }
    const userId = req.user.id;
    const nameVersion = `${name}_${version}`;
    const nameVersionUserId = `${userId}_${name}_${version}`;

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
