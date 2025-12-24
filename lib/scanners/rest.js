const { ScannerAbstract } = require("./abstract");

class ScannerRest extends ScannerAbstract {
  
  getRegex() {
    this.sectionLevels = {};
    return /^(.+)\n([!-/:-@[-`{-~])\2+$/gim;
  }

  parse(object) {
    let match = object.match;
    let level = 1;
    let c = match[2].substr(0, 1);
    if (c in this.sectionLevels) {
      level = this.sectionLevels[c];
    } else {
      level = Object.keys(this.sectionLevels).length + 1;
      this.sectionLevels[c] = level;
    }
    return { level, text: match[1], classList: [] };
  }
}

module.exports = { ScannerRest };
