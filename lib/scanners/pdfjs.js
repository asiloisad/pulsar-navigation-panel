class ScannerPDFjs {
  constructor(viewer) {
    this.viewer = viewer;
    this.snoFilter = atom.config.get("navigation-panel.pdfjs.snoFilter");
  }

  getHeaders(outline) {
    if (!outline) {
      return [];
    }
    this.index = 0;
    this.parse(outline, 1);
    return outline;
  }

  parse(data, revel) {
    for (let item of data) {
      if (this.snoFilter) {
        item.text = item.title.replace(/[\d.]+ (.+)/g, "$1");
      } else {
        item.text = item.title;
      }
      item.viewer = this.viewer;
      item.children = item.items;
      item.classList = [];
      item.level = item.revel = revel;
      item.startPoint = { row: this.index++ };
      this.parse(item.children, revel + 1);
    }
  }
}

module.exports = { ScannerPDFjs };
