'use strict'

const { omitBy, isNil } = require('lodash')

function getAll({ status, until, after, limit, direction, nested } = {}) {
  const queryParams = omitBy({
    status,
    until,
    after,
    limit,
    direction,
    nested
  }, isNil)
  return this.httpRequest('/orders', queryParams)
}

function getOne(id) {
  return this.httpRequest('/orders/' + id)
}

function getByClientOrderId(clientOrderId) {
  const queryParams = { client_order_id: clientOrderId }
  return this.httpRequest('/orders:by_client_order_id', queryParams)
}

function post(order) {
  return this.httpRequest('/orders', null, order, 'POST')
}

function cancel(id) {
  return this.httpRequest('/orders/' + id, null, null, 'DELETE')
}

function cancelAll() {
  return this.httpRequest('/orders', null, null, 'DELETE')
}

function patchOrder(id, newOrder) {
  return this.httpRequest(`/orders/${id}`, null, newOrder, 'PATCH')
}

module.exports = {
  getAll,
  getOne,
  getByClientOrderId,
  post,
  patchOrder,
  cancel,
  cancelAll,
}
