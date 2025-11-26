const { ScannerAbstract } = require("./abstract");

class ScannerSinumerik extends ScannerAbstract {
  constructor(editor) {
    super(editor, /^;{2}[*+\-!]? (.+)$/g);
  }

  parse(object) {
    let match = object.match;
    let classList;
    if (match[0][2] === "*") {
      classList = ["info"];
    } else if (match[0][2] === "+") {
      classList = ["success"];
    } else if (match[0][2] === "-") {
      classList = ["warning"];
    } else if (match[0][2] === "!") {
      classList = ["error"];
    } else {
      classList = [];
    }
    return { level: 0, text: match[1], classList };
  }
}

module.exports = { ScannerSinumerik };
