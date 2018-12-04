'use stricts'

// certain endpoints don't accept ISO dates,
// so to allow the user to use regular JS date objects
// with the api, we need to convert them to strings
function toDateString (date) {
  if (date == null || typeof date === 'string') return date
  const year = date.getUTCFullYear()
  const month = numPad(date.getUTCMonth() + 1)
  const day = numPad(date.getUTCDate())
  return `${year}-${month}-${day}`
}

function numPad (num) {
  if (num < 10) {
    return '0' + num
  }
  return num
}

module.exports = {
  toDateString
}
