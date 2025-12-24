const { ScannerAbstract } = require("./abstract");

class ScannerLatex extends ScannerAbstract {
  
  getRegex() {
    this.secCommands = [
      atom.config.get("navigation-panel.latex.commands.4"),
      atom.config.get("navigation-panel.latex.commands.5"),
      atom.config.get("navigation-panel.latex.commands.6"),
      atom.config.get("navigation-panel.latex.commands.7"),
      atom.config.get("navigation-panel.latex.commands.8"),
      atom.config.get("navigation-panel.latex.commands.9"),
      atom.config.get("navigation-panel.latex.commands.10"),
    ];
    return new RegExp(
      "([^%\\n]*)%(\\$+)([\\*\\+\\-\\!\\_]?)%(.*)|^[^\\%\\n]*\\\\(" +
        this.secCommands.join("|") +
        ")\\*?(?:\\[(.*)\\])?{(.*)}",
      "g"
    );
  }

  parse(object) {
    let match = object.match;
    let level, text;
    let classList = [];
    if (match[2]) {
      level = match[2].length;
      text = `${match[1].trim()} ${match[4].trim()}`.trim().replace(/~+/g, " ");
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
      }
    } else if (match[5]) {
      level = match[5].toLowerCase();
      for (let i = 0; i < this.secCommands.length; i++) {
        if (this.secCommands[i] && level.match(`^(${this.secCommands[i]})$`)) {
          level = 4 + i;
          break;
        }
      }
      text = match[6] ? match[6] : match[7];
      let count = 0;
      for (var i = 0; i < text.length; i++) {
        let char = text.charAt(i);
        if (char === "{") {
          count++;
        } else if (char === "}") {
          if (count === 0) {
            break;
          } else {
            count--;
          }
        }
      }
      text = text
        .substring(0, i)
        .trim()
        .replace(/~+/g, " ")
        .replace(/--/g, "–")
        .replace(/(?<!\\)\$/g, "")
        .replace(/\\\$/g, "$")
        .replace(/\\%/g, "%")
        .replace(/\{?\\(?:text|up)theta\}?/, "θ")
        .replace(/\{?\\(?:text|up)Theta\}?/, "Θ")
        .replace(/\{?\\(?:text|up)omega\}?/, "ω")
        .replace(/\{?\\(?:text|up)Omega\}?/, "Ω")
        .replace(/\{?\\(?:text|up)varepsilon\}?/, "ε")
        .replace(/\{?\\(?:text|up)Epsilon\}?/, "Ε")
        .replace(/\{?\\(?:text|up)epsilon\}?/, "ϵ")
        .replace(/\{?\\(?:text|up)rho\}?/, "ρ")
        .replace(/\{?\\(?:text|up)Rho\}?/, "Ρ")
        .replace(/\{?\\(?:text|up)tau\}?/, "τ")
        .replace(/\{?\\(?:text|up)Tau\}?/, "Τ")
        .replace(/\{?\\(?:text|up)psi\}?/, "ψ")
        .replace(/\{?\\(?:text|up)Psi\}?/, "Ψ")
        .replace(/\{?\\(?:text|up)upsilon\}?/, "υ")
        .replace(/\{?\\(?:text|up)Upsilon\}?/, "Υ")
        .replace(/\{?\\(?:text|up)iota\}?/, "ι")
        .replace(/\{?\\(?:text|up)Iota\}?/, "Ι")
        .replace(/\{?\\(?:text|up)omnikron\}?/, "ο")
        .replace(/\{?\\(?:text|up)Omikron\}?/, "Ο")
        .replace(/\{?\\(?:text|up)pi\}?/, "π")
        .replace(/\{?\\(?:text|up)Pi\}?/, "Π")
        .replace(/\{?\\(?:text|up)alpha\}?/, "α")
        .replace(/\{?\\(?:text|up)Alpha\}?/, "Α")
        .replace(/\{?\\(?:text|up)sigma\}?/, "σ")
        .replace(/\{?\\(?:text|up)Sigma\}?/, "Σ")
        .replace(/\{?\\(?:text|up)delta\}?/, "δ")
        .replace(/\{?\\(?:text|up)Delta\}?/, "Δ")
        .replace(/\{?\\(?:text|up)varphi\}?/, "φ")
        .replace(/\{?\\(?:text|up)theta\}?/, "ϑ")
        .replace(/\{?\\(?:text|up)gamma\}?/, "γ")
        .replace(/\{?\\(?:text|up)Gamma\}?/, "Γ")
        .replace(/\{?\\(?:text|up)eta\}?/, "η")
        .replace(/\{?\\(?:text|up)Eta\}?/, "Η")
        .replace(/\{?\\(?:text|up)phi\}?/, "ϕ")
        .replace(/\{?\\(?:text|up)Phi\}?/, "Φ")
        .replace(/\{?\\(?:text|up)kappa\}?/, "κ")
        .replace(/\{?\\(?:text|up)Kappa\}?/, "Κ")
        .replace(/\{?\\(?:text|up)lambda\}?/, "λ")
        .replace(/\{?\\(?:text|up)Lambda\}?/, "Λ")
        .replace(/\{?\\(?:text|up)zeta\}?/, "ζ")
        .replace(/\{?\\(?:text|up)Zeta\}?/, "Ζ")
        .replace(/\{?\\(?:text|up)xi\}?/, "ξ")
        .replace(/\{?\\(?:text|up)Xi\}?/, "Ξ")
        .replace(/\{?\\(?:text|up)chi\}?/, "χ")
        .replace(/\{?\\(?:text|up)Chi\}?/, "Χ")
        .replace(/\{?\\(?:text|up)beta\}?/, "β")
        .replace(/\{?\\(?:text|up)Beta\}?/, "Β")
        .replace(/\{?\\(?:text|up)nu\}?/, "ν")
        .replace(/\{?\\(?:text|up)Nu\}?/, "Ν")
        .replace(/\{?\\(?:text|up)mu\}?/, "μ")
        .replace(/\{?\\(?:text|up)Mu\}?/, "Μ");
    }
    return { level, text, classList };
  }
}

module.exports = { ScannerLatex };
