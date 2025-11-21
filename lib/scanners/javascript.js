const { ScannerAbstract } = require('./abstract')

class ScannerJavascript extends ScannerAbstract {

  constructor(editor) {
    super(editor, /^([^\/\n]*)\/\/(%%)?(\$+[scfv1]?|\?)([\*\+\-\!]?)([\_\<\;]*)\/\/(.*)/gi)
  }

  parse(object) {
    let match = object.match
    let level, text, subre
    let classList = []

    if (match[3]==='?') {
      subre = /\( *(\d+) *, *[rf]*['\"](.*?)['\"]/.exec(match[0])
      if (!subre) {return}
      level = parseInt(subre[1])
      if (!level || level > this.maxDepth || level<1 || level>9) {
        return
      } else {
        text = `${subre[2].trim()} ${match[6].trim()}`
      }

    } else if (match[3].slice(-1)==='s') {
      subre = /['\"](.*?)['\"]/.exec(match[0])
      level = match[3].length-1
      if (subre) {
        text = subre[1]+' '+match[6].trim()
      } else {
        text = `${match[1].trim()} ${match[6].trim()}`
      }

    } else if (match[3].slice(-1)==='c') {
      subre = /((?:class|interface|enum)[^\:\{\n]*)/.exec(match[0])
      level = match[3].length-1
      if (subre) {
        text = subre[1]+' '+match[6].trim()
      } else {
        text = `${match[1].trim()} ${match[6].trim()}`
      }

    } else if (match[3].slice(-1)==='f') {
      subre = /((?:function|const|let|var|async)[^\:\{\n]*)/.exec(match[0])
      level = match[3].length-1
      if (subre) {
        text = subre[1]+' '+match[6].trim()
      } else {
        text = `${match[1].trim()} ${match[6].trim()}`
      }

    } else if (match[3].slice(-1)==='v') {
      subre = / *(const|let|var) +(.+?) *=/.exec(match[0])
      level = match[3].length-1
      if (subre) {
        text = subre[2]+' '+match[6].trim()
      } else {
        text = `${match[1].trim()} ${match[6].trim()}`
      }

    } else if (match[3].slice(-1)==='1') {
      level = match[3].length-1

      let sr0 = match[1].split(' ')[0]
      if (sr0.slice(-1)==='{') {
        sr0 = sr0.substring(0, sr0.length - 1)
      }
      text = (sr0 + ' ' + match[6]).trim()

    } else {
      level = match[3].length
      text = `${match[1].trim()} ${match[6].trim()}`
    }

    text = text.replace(/~+/g, ' ').replace(/--/g, '–')

    if (match[2]) {
      classList.push('cell')
    }
    if (match[4]==='*') {
      classList.push('info')
    } else if (match[4]==='+') {
      classList.push('success')
    } else if (match[4]==='-') {
      classList.push('warning')
    } else if (match[4]==='!') {
      classList.push('error')
    }
    if (match[5]) {
      if (new Set(match[5]).size !== match[5].length) {
        return // don't allow duplicates
      }
      if (match[5].includes('_')) {
        classList.push('separator')
      }
      if (match[5].includes('<')) {
        classList.push('larger')
      }
      if (match[5].includes(';')) {
        classList.push('bolder')
      }
    }

    return { level, text, classList }
  }
}

module.exports = { ScannerJavascript }
