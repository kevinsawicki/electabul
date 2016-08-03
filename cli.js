#!/usr/bin/env node

require('yargs')
  .usage('$0 <cmd> [args]')
  .command('instrument', 'Instrument a .asar file', {
    'input-path': {
      demand: true,
      describe: 'Path to source directory to instrument'
    },
    'output-path': {
      demand: true,
      describe: 'Path to .asar file to create'
    }
  }, function (argv) {
    require('./index.js').createInstrumentedAsar(argv, function (error, outputPath, fileCount) {
      if (error) {
        console.error(error.stack || error)
        process.exit(1)
      } else {
        console.log('Created ' + outputPath + ' with ' + fileCount + ' instrumented files')
      }
    })
  })
  .help('help')
  .argv
