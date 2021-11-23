"use strict";

const { omitBy, isNil } = require("lodash");

async function getAll({ status, until, after, limit, direction, nested } = {}) {
  const queryParams = omitBy(
    {
      status,
      until,
      after,
      limit,
      direction,
      nested,
    },
    isNil
  );
  return this.makeRequest("/orders", queryParams);
}

function getOne(id) {
  return this.makeRequest("/orders/" + id);
}

function getByClientOrderId(clientOrderId) {
  const queryParams = { client_order_id: clientOrderId };
  return this.makeRequest("/orders:by_client_order_id", queryParams);
}

function post(order) {
  return this.makeRequest("/orders", null, order, "POST");
}

function cancel(id) {
  return this.makeRequest("/orders/" + id, null, null, "DELETE");
}

function cancelAll() {
  return this.makeRequest("/orders", null, null, "DELETE");
}

function patchOrder(id, newOrder) {
  return this.makeRequest(`/orders/${id}`, null, newOrder, "PATCH");
}

module.exports = {
  getAll,
  getOne,
  getByClientOrderId,
  post,
  patchOrder,
  cancel,
  cancelAll,
};
