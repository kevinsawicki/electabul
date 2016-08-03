var instrument = require('./instrument')

exports.createInstrumentedAsar = function (options, callback) {
  instrument(options, callback)
}
