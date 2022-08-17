'use stricts'

// Crypto v1beta2 endpoints return a mapping of each symbol to its array
// of objects. This f'n is used to rename the properties each symbol's
// array of objects.
function renameObjects(array, renamingFunction) {
  for (let i=0; i<array.length; i++) {
    array[i] = renamingFunction(array[i])
  }
  return array
}

module.exports = {
  renameObjects
}