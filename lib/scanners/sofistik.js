/** @babel */
/** @jsx etch.dom */

const etch = require("etch");
const { ScannerAbstract } = require("./abstract");

class ScannerSofistik extends ScannerAbstract {

  getRegex() {
    this.inBlock = atom.config.get("navigation-panel.sofistik.inBlock");
    this.icons = atom.config.get("navigation-panel.sofistik.icons");
    return /^ *(#define [^\n=]+$|#enddef)|^!([+-\\#\\$])!(?:chapter|kapitel) (.*)|(^(?! *\$)[^!\n]*)!(\$+)!(.*)|^ *([+-])?prog +([^\n]*)|^ *!.! +(.*)|^\$ graphics +(\d+) +\| +picture +(\d+) +\| +layer +(\d+) +: *(.*)/gim;
  }

  beforeScan() {
    this.defineCount = 0;
  }

  parse(object) {
    let match = object.match;
    let level, text, display, iconClass, test;
    if (!this.inBlock) {
      if (match[1]) {
        if (match[1].charAt(1) === "d") {
          this.defineCount++;
        } else {
          this.defineCount--;
        }
        return;
      }
    } else if (match[1]) {
      return;
    }
    if (this.defineCount > 0) {
      return;
    } else if (match[5]) {
      level = match[5].length;
      text = `${match[4].trim()} ${match[6].trim()}`.trim();
    } else if (match[3]) {
      level = 4;
      text = match[3].trim();
      if ((test = text.match(/^(?:-+|=+|\*+) (.+?) (?:-+|=+|\*+)$/))) {
        text = test[1];
      }
      if (this.icons) {
        if (match[2] === "+") {
          iconClass = "navigation-icon sofistik-navi-icon icon-unfold";
        } else if (match[2] === "-") {
          iconClass = "navigation-icon sofistik-navi-icon icon-fold";
        } else {
          iconClass = "navigation-icon sofistik-navi-icon icon-info";
        }
        display = (
          <div
            class={iconClass}
            on={{ click: (e) => this.toggleChapter(e, object) }}
          />
        );
      }
    } else if (match[8]) {
      level = 5;
      text = match[8].replace(/urs:.+/i, "").trim();

      // Look for HEAD line on the next line
      const matchEndPos = object.range.end;
      const nextLineNum = matchEndPos.row + 1;
      if (nextLineNum < this.editor.getLineCount()) {
        const nextLine = this.editor.lineTextForBufferRow(nextLineNum);
        const headMatch = nextLine.match(/^ *head +(.+)/);
        if (headMatch) {
          text = `${text}: ${headMatch[1]}`.trim();
        }
      }

      if (this.icons) {
        if (match[7] === "+") {
          iconClass =
            "navigation-icon sofistik-navi-icon status-added icon-diff-added";
        } else if (match[7] === "-") {
          iconClass =
            "navigation-icon sofistik-navi-icon status-removed icon-diff-removed";
        } else {
          iconClass =
            "navigation-icon sofistik-navi-icon status-modified icon-diff-modified";
        }
        display = (
          <div
            class={iconClass}
            on={{ click: (e) => this.toggleProg(e, object) }}
          />
        );
      } else {
        iconClass = null;
      }
    } else if (match[9]) {
      level = 6;
      text = match[9].trim();
      if ((test = text.match(/^(?:-+|=+|\*+) (.+?) (?:-+|=+|\*+)$/))) {
        text = test[1];
      }
    } else if (match[10]) {
      let text1, text2;
      level = 7;
      text1 = `${match[10]}-${match[11]}-${match[12]}`;
      text2 = match[13] ? match[13] : "";
      // text = `${text2}`.trim();
      // display = (
      //   <span class="navigation-sofistik">
      //     <span class='badge badge-flexible'>{text1}</span>
      //   </span>
      // )
      text = `${text1}: ${text2}`.trim();
    } else {
      return;
    }
    return { level, text, classList: [], iconClass, display };
  }

  toggleChapter(e, object) {
    if (object.match[2] === "+") {
      object.replace(object.matchText.replace(/!\+!/i, "!-!"));
      e.srcElement.className =
        "navigation-icon sofistik-navi-icon icon-fold";
    } else if (object.match[2] === "-") {
      object.replace(object.matchText.replace(/!-!/i, "!+!"));
      e.srcElement.className =
        "navigation-icon sofistik-navi-icon icon-unfold";
    }
  }

  toggleProg(e, object) {
    if (object.match[7] === "+") {
      object.replace(object.matchText.replace(/\+(prog)/i, "-$1"));
      e.srcElement.className =
        "navigation-icon sofistik-navi-icon status-removed icon-diff-removed";
    } else if (object.match[7] === "-") {
      object.replace(object.matchText.replace(/-(prog)/i, "+$1"));
      e.srcElement.className =
        "navigation-icon sofistik-navi-icon status-added icon-diff-added";
    }
  }
}

module.exports = { ScannerSofistik };
