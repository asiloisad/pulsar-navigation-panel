/** @babel */
/** @jsx etch.dom */

const etch = require('etch')
const { ScannerAbstract } = require('./abstract')

class ScannerSofistik extends ScannerAbstract {

  constructor(editor) {
    super(editor, /^ *(#define [^\n=]+$|#enddef)|^!([+-\\#\\$])!(?:chapter|kapitel) (.*)|(^(?! *\$)[^!\n]*)!(\$+)!(.*)|^ *([+-])?prog +([^\n]*)(?:\n *head +(.+))?|^ *!.! +(.*)|^\$ graphics +(\d+) +\| +picture +(\d+) +\| +layer +(\d+) +: *(.*)/gmi)
    this.defineCount = 0
    this.inBlock = atom.config.get('navigation-panel.sofistik.inBlock')
    this.icons = atom.config.get('navigation-panel.sofistik.icons')
  }

  parse(object) {
    let match = object.match
    let level, text, display, sign, iconClass, test
    if (!this.inBlock) {
      if (match[1]) {
        if (match[1].charAt(1)==='d') {
          this.defineCount++
        } else {
          this.defineCount--
        }
        return
      }
    } else if (match[1]) {
      return
    }
    if (this.defineCount>0) {
      return
    } else if (match[5]) {
      level = match[5].length
      text = `${match[4].trim()} ${match[6].trim()}`.trim()
    } else if (match[3]) {
      level = 4
      text = match[3].trim()
      if (test = text.match(/^(?:-+|=+|\*+) (.+?) (?:-+|=+|\*+)$/)) { text = test[1] }
      if (this.icons) {
        sign = match[2]
        if (sign==='+') {
          iconClass = 'sofistik-navi-icon icon icon-unfold'
        } else if (sign==='-') {
          iconClass = 'sofistik-navi-icon icon icon-fold'
        } else {
          iconClass = 'sofistik-navi-icon icon icon-info'
        }
        display = [<span class={iconClass} on={{click:(e)=>this.toggleChapter(e, object)}}/>, <span>{text}</span>]
      }
    } else if (match[8]) {
      level = 5
      text = match[8].replace(/urs\:.+/i, '').trim()
      if (match[9]) { text = `${text}: ${match[9]}`.trim()}
      sign = match[7] ? match[7] : '*'
      if (this.icons) {
        if (match[7]==='+') {
          iconClass = 'sofistik-navi-icon status-added icon icon-diff-added'
        } else if (match[7]==='-') {
          iconClass = 'sofistik-navi-icon status-removed icon icon-diff-removed'
        } else {
          iconClass = 'sofistik-navi-icon status-modified icon icon-diff-modified'
        }
        display = [<span class={iconClass} on={{click:(e)=>this.toggleProg(e, object)}}/>, <span>{text}</span>]
      }
      text = sign+text
    } else if (match[10]) {
      level = 6
      text = match[10].trim()
      if (test = text.match(/^(?:-+|=+|\*+) (.+?) (?:-+|=+|\*+)$/)) { text = test[1] }
    } else if (match[11]) {
      let text1, text2
      level = 7
      text1 = `${match[11]}-${match[12]}-${match[13]}`
      text2 = match[14] ? match[14] : ''
      text  = `[${text1}] ${text2}`.trim()
      display = [
        <span class='badge badge-flexible'>{text1}</span>, <span>{text2}</span>]
    } else {
      return
    }
    return {level, text, classList:[], display}
  }

  toggleChapter(e, object) {
    if (object.match[2]==='+') {
      object.replace(object.matchText.replace(/!\+!/i, '!-!'))
      e.srcElement.className = 'sofistik-navi-icon icon icon-fold'
    } else if (object.match[2]==='-') {
      object.replace(object.matchText.replace(/!\-!/i, '!+!'))
      e.srcElement.className = 'sofistik-navi-icon icon icon-unfold'
    }
  }

  toggleProg(e, object) {
    if (object.match[7]==='+') {
      object.replace(object.matchText.replace(/\+(prog)/i, '-$1'))
      e.srcElement.className = 'sofistik-navi-icon status-removed icon icon-diff-removed'
    } else if (object.match[7]==='-') {
      object.replace(object.matchText.replace(/\-(prog)/i, '+$1'))
      e.srcElement.className = 'sofistik-navi-icon status-added icon icon-diff-added'
    }
  }
}

module.exports = { ScannerSofistik }
