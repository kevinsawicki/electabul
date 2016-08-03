var asar = require('asar')
var fs = require('fs')
var glob = require('glob')
var Instrumenter = require('istanbul').Instrumenter
var mkdirp = require('mkdirp')
var path = require('path')
var temp = require('temp').track()

module.exports = function (options, callback) {
  var instrumenter = new Instrumenter()
  var inputPath = path.resolve(options.inputPath)
  var outputPath = path.resolve(options.outputPath)
  var tempPath = temp.mkdirSync('elactabul')
  var fileCount = 0

  glob.sync('**/*.js', {cwd: inputPath}).forEach(function (relativePath) {
    var rawPath = path.join(inputPath, relativePath)
    var raw = fs.readFileSync(rawPath, 'utf8')

    var generatedPath = path.join(tempPath, relativePath)
    var generated = instrumenter.instrumentSync(raw, rawPath)

    mkdirp.sync(path.dirname(generatedPath))
    fs.writeFileSync(generatedPath, generated)
    fileCount++
  })

  asar.createPackageWithOptions(tempPath, outputPath, {}, function (error) {
    callback(error, outputPath, fileCount)
  })
}
