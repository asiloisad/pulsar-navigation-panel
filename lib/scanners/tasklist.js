const { ScannerAbstract } = require("./abstract");

class ScannerTasklist extends ScannerAbstract {
  constructor(editor) {
    super(editor, /(?:^(#+) +(.+?) *$|^ *([^▷☐✔✘• \n].*?) *: *$)/g);
    this.useHeaders = atom.config.get("navigation-panel.tasklist.useHeaders");
  }

  parse(object) {
    let match = object.match;
    if (match[1]) {
      return { level: match[1].length, text: match[2], classList: [] };
    } else if (this.useHeaders) {
      return { level: 5, text: match[3], classList: [] };
    }
  }
}

module.exports = { ScannerTasklist };
