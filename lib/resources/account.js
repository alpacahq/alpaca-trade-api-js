"use strict";

const { omitBy, isNil } = require("lodash");

async function get() {
  return this.makeRequest("/account");
}

async function updateConfigs(configs) {
  return this.makeRequest("/account/configurations", null, configs, "PATCH");
}

async function getConfigs() {
  return this.makeRequest("/account/configurations");
}

async function getActivities({
  activityTypes,
  until,
  after,
  direction,
  date,
  pageSize,
  pageToken,
}) {
  if (Array.isArray(activityTypes)) {
    activityTypes = activityTypes.join(",");
  }
  const queryParams = omitBy(
    {
      activity_types: activityTypes,
      until,
      after,
      direction,
      date,
      page_size: pageSize,
      page_token: pageToken,
    },
    isNil
  );
  return this.makeRequest("/account/activities", queryParams);
}

async function getPortfolioHistory({
  date_start,
  date_end,
  period,
  timeframe,
  extended_hours,
}) {
  const queryParams = omitBy(
    {
      date_start,
      date_end,
      period,
      timeframe,
      extended_hours,
    },
    isNil
  );
  return this.makeRequest("/account/portfolio/history", queryParams);
}

module.exports = {
  get,
  getConfigs,
  updateConfigs,
  getActivities,
  getPortfolioHistory,
};
