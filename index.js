var instrument = require('./instrument')
var Coverage = require('./coverage')

exports.createInstrumentedAsar = function (options, callback) {
  instrument(options, callback)
}

exports.Coverage = Coverage
