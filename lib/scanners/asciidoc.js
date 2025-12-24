const { ScannerAbstract } = require("./abstract");

class ScannerAsciiDoc extends ScannerAbstract {
  
  getRegex() {
    return /^(=+|#+)[ \t]+(.+?)(?:[ \t]+\1)?$/gm;
  }

  parse(object) {
    let match = object.match;
    return { level: match[1].length, text: match[2], classList: [] };
  }
}

module.exports = { ScannerAsciiDoc };
