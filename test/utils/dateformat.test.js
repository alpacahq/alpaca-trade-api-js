'use strict'

const expect = require('chai').expect
const dateformat = require('../../lib/utils/dateformat')

describe('date formatting', () => {
  it('formats timestamps as dates', () => {
    const formatted = dateformat.toDateString(new Date('July 20, 69 00:20:18'))
    expect(formatted).to.equal('1969-07-20')
  })

  it('passes nil through', () => {
    expect(dateformat.toDateString(null)).to.equal(null)
  })

  it('passes strings through', () => {
    expect(dateformat.toDateString('2018-12-03')).to.equal('2018-12-03')
  })
})
