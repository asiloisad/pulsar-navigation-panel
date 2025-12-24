const { ScannerAbstract } = require("./abstract");

class ScannerMarkdown extends ScannerAbstract {
  
  getRegex() {
    return /^(#+) (.+)$/g;
  }

  parse(object) {
    let match = object.match;
    return { level: match[1].length, text: match[2], classList: [] };
  }
}

module.exports = { ScannerMarkdown };
