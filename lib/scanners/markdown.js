const { ScannerAbstract } = require("./abstract");

class ScannerMarkdown extends ScannerAbstract {

  getRegex() {
    return /^(`{3,})|^(~{3,})|(#+) (.+)$/gm;
  }

  beforeScan() {
    this.insideCode1 = false;
    this.insideCode2 = false;
  }

  parse(object) {
    let match = object.match;
    if (match[1]) {
      this.insideCode1 = !this.insideCode1;
      return;
    }
    if (match[2]) {
      this.insideCode2 = !this.insideCode2;
      return;
    }
    if (this.insideCode1 || this.insideCode2) {
      return;
    }
    return { level: match[3].length, text: match[4], classList: [] };
  }
}

module.exports = { ScannerMarkdown };
