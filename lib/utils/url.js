function buildQueryString(params) {
  var queryString = '';
  if (!params) return queryString;

  Object.keys(params).forEach(function(key, index) {
    if (index === 0) {
      queryString += '?';
    } else {
      queryString += '&';
    }
    queryString += `${key}=${params[key]}`;
  });

  return queryString;
}

module.exports = {
  buildQueryString,
};
