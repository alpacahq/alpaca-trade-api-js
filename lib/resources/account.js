"use strict";

const { omitBy, isNil } = require("lodash");

async function get() {
  //const resp = await this.httpRequest("/account/configurations");
  //return resp.data;
  return this.requestWrapper(this.httpRequest, "/account");
}

async function updateConfigs(configs) {
  const resp = await this.httpRequest(
    "/account/configurations",
    null,
    configs,
    "PATCH"
  );
  return resp.data;
}

async function getConfigs() {
  const resp = await this.httpRequest("/account/configurations");
  return resp.data;
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
  const resp = await this.httpRequest("/account/activities", queryParams);
  return resp.data;
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
  const resp = this.httpRequest("/account/portfolio/history", queryParams);
  return resp.data;
}

module.exports = {
  get,
  getConfigs,
  updateConfigs,
  getActivities,
  getPortfolioHistory,
};
