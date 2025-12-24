/** @babel */
/** @jsx etch.dom */

const etch = require("etch");
const { ScannerAbstract } = require("./abstract");

class ScannerBibtex extends ScannerAbstract {

  getRegex() {
    return /([^%\n]*)%(\$+)([\*\+\-\!\_]?)%(.*)|^[ ]*\@(\w*)[ ]*{[ ]*([^\,]*)/gim;
  }

  parse(object) {
    let display, level, text, classList;
    let match = object.match;
    if (match[2]) {
      level = match[2].length;
      text = `${match[1].trim()} ${match[4].trim()}`.trim();
    } else if (match[5]) {
      level = 4;
      // text = match[6].trim();
      // display = (
      //   <span class="navigation-bibtex">
      //     <span class="badge badge-flexible">{match[5].trim()}</span>
      //   </span>
      // );
      text = `${match[5].trim()}: ${match[6].trim()}`;
    }
    if (match[3] === "*") {
      classList = ["info"];
    } else if (match[3] === "+") {
      classList = ["success"];
    } else if (match[3] === "-") {
      classList = ["warning"];
    } else if (match[3] === "!") {
      classList = ["error"];
    } else if (match[3] === "_") {
      classList = ["separator"];
    } else {
      classList = [];
    }
    return { level, text, classList, display };
  }
}

module.exports = { ScannerBibtex };
