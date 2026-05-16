const { ScannerAbstract } = require("./abstract");

class ScannerTypst extends ScannerAbstract {
  getRegex() {
    return /^(`{3,})|^ *(=+) (.+)$/gm;
  }

  beforeScan() {
    this.insideCode = false;
  }

  parse(object) {
    let match = object.match;
    if (match[1]) {
      this.insideCode = !this.insideCode;
      return;
    }
    if (this.insideCode) {
      return;
    }
    return { level: match[2].length, text: match[3], classList: [] };
  }
}

module.exports = { ScannerTypst };
