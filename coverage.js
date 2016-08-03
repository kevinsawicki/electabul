const fs = require('fs')
const glob = require('glob')
const mkdirp = require('mkdirp')
const path = require('path')
const rimraf = require('rimraf')
const {Collector, Instrumenter, Reporter} = require('istanbul')

class Coverage {
  constructor (options) {
    this.outputPath = path.resolve(options.outputPath || '.')
    this.dataPath = path.join(this.outputPath, 'data')
    this.libPath = path.resolve(options.libPath || '.')
    this.formats = options.formats
    this.collector = new Collector()
  }

  // Setup coverage for the current app
  setup () {
    if (!this.isEnabled()) return

    rimraf.sync(this.dataPath)
    this.patchBrowserWindow()
    this.saveCoverageOnBeforeUnload()
  }

  // Generate a code coverage report
  generateReport () {
    if (!this.isEnabled()) return

    this.addUnrequiredFiles()
    this.addCoverage(window.__coverage__)
    this.addBrowserWindowData()

    const reporter = new Reporter(null, this.outputPath)
    reporter.addAll(this.formats)
    reporter.write(this.collector, true, function () {})
  }

  addCoverage (data) {
    if (data != null) this.collector.add(data)
  }

  isEnabled () {
    if (typeof window !== 'undefined') {
      return window.__coverage__ != null
    } else {
      return global.__coverage__ != null
    }
  }

  // Add unrequired files to the coverage report so all files are present there
  addUnrequiredFiles () {
    const instrumenter = new Instrumenter()
    const coverage = window.__coverage__

    glob.sync('**/*.js', {cwd: this.libPath}).map((relativePath) => {
      return path.join(this.libPath, relativePath)
    }).filter((filePath) => {
      return coverage[filePath] == null
    }).forEach((filePath) => {
      instrumenter.instrumentSync(fs.readFileSync(filePath, 'utf8'), filePath)

      // When instrumenting the code, istanbul will give each FunctionDeclaration
      // a value of 1 in coverState.s,presumably to compensate for function
      // hoisting. We need to reset this, as the function was not hoisted, as it
      // was never loaded.
      Object.keys(instrumenter.coverState.s).forEach((key) => {
          instrumenter.coverState.s[key] = 0
      });

      coverage[filePath] = instrumenter.coverState
    })
  }

  // Add coverage data to collector for all opened browser windows
  addBrowserWindowData () {
    glob.sync('*.json', {cwd: this.dataPath}).map((relativePath) => {
      return path.join(this.dataPath, relativePath)
    }).forEach((filePath) => {
      this.collector.add(JSON.parse(fs.readFileSync(filePath)));
    })
  }

  // Save coverage data from the browser window with the given pid
  saveCoverageData (webContents, coverage, pid) {
    if (!coverage) return
    if (pid == null) pid = webContents.getId()

    const suffix = `${webContents.getType()}-${Date.now()}`
    const dataPath = path.join(this.dataPath, `${pid}-${suffix}.json`)
    mkdirp.sync(path.dirname(dataPath))
    fs.writeFileSync(dataPath, JSON.stringify(coverage))
  }

  getCoverageFromWebContents (webContents, callback) {
    webContents.executeJavaScript('[window.__coverage__, window.process && window.process.pid]', (results) => {
      const coverage = results[0]
      const pid = results[1]
      callback(coverage, pid)
    })
  }

  saveWebContentsCoverage (webContents, callback) {
    this.getCoverageFromWebContents(webContents, (coverage, pid) => {
      this.saveCoverageData(webContents, coverage, pid)
      callback()
    })
  }

  // Patch BrowserWindow methods to handle instrumenting windows that are
  // explicitly destroyed via .close()
  patchBrowserWindow () {
    const {BrowserWindow} = require('electron')

    const {close} = BrowserWindow.prototype
    const self = this
    BrowserWindow.prototype.close = function () {
      if (this.isDestroyed() || !this.getURL() || !this.devToolsWebContents) {
        return close.call(this)
      }

      self.saveWebContentsCoverage(this.devToolsWebContents, () => {
        close.call(this)
      })
    }
  }

  saveCoverageOnBeforeUnload () {
    const {app, ipcMain} = require('electron')

    ipcMain.on('save-coverage', (event, coverage, pid) => {
      this.saveCoverageData(event.sender, coverage, pid)
    })

    ipcMain.on('report-coverage', (event, message) => {
      this.saveCoverageData(event.sender, message.coverage, `${message.pid}-extension`)
    })

    app.on('web-contents-created', (event, webContents) => {
      webContents.executeJavaScript(`
        window.addEventListener('beforeunload', function () {
          if (typeof require !== 'undefined') {
            require('electron').ipcRenderer.send('save-coverage', window.__coverage__, window.process && window.process.pid)
          }
        })
      `)
    })
  }
}

module.exports = Coverage
