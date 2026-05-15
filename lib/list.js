const { CompositeDisposable } = require("atom");
const { SelectListView, createTwoLineItem, highlightMatches } = require("@asiloisad/select-list");

class NavigationList {
  constructor({ getItems, hasHeaders, didConfirmSelection, didScrollSelection }) {
    this.getItems = getItems;
    this.hasHeaders = hasHeaders;
    this.didConfirmSelection = didConfirmSelection;
    this.didScrollSelection = didScrollSelection;
    this.dirty = true;

    this.selectList = new SelectListView({
      className: "navigation-panel-list",
      emptyMessage: "No headers found",
      placeholderText: "Search headers...",
      removeDiacritics: true,
      algorithm: "fuzzaldrin",
      helpMarkdown:
        "Available commands:\n" +
        "- **Enter**: Navigate to header\n" +
        "- **Alt+Enter**: Scroll to header",
      filterKeyForItem: (item) => this.primaryTextForItem(item),
      elementForItem: (item, options) => this.elementForItem(item, options),
      didConfirmSelection: (item) => this.confirmSelection(item),
      didCancelSelection: () => this.selectList.hide(),
      willShow: () => this.update(),
    });

    this.disposables = new CompositeDisposable(
      atom.commands.add(this.selectList.element, {
        "select-list:scroll": () => this.scrollSelection(this.selectList.getSelectedItem()),
      }),
    );
  }

  toggle() {
    this.selectList.toggle();
  }

  markDirty() {
    this.dirty = true;
    if (this.selectList.isVisible()) {
      this.update();
    }
  }

  update() {
    if (this.dirty) {
      this.selectList.update({
        items: this.getItems(),
        infoMessage: this.hasHeaders() ? null : "This grammar is not supported",
      });
      this.dirty = false;
    }
  }

  elementForItem(item, { matchIndices }) {
    const primary = document.createDocumentFragment();
    primary.appendChild(highlightMatches(this.primaryTextForItem(item), matchIndices));

    const element = createTwoLineItem({
      primary: primary,
      secondary: this.secondaryTextForItem(item),
    });
    if (item.classList && item.classList.length) {
      element.classList.add(...item.classList);
    }
    return element;
  }

  secondaryTextForItem(item) {
    if (item.viewer && item.resolvedDest) {
      return `Page ${item.resolvedDest.pageIndex + 1}`;
    } else if (item.startPoint) {
      return `Line ${item.startPoint.row + 1}`;
    } else if (item.filePath) {
      return item.filePath;
    }
  }

  primaryTextForItem(item) {
    return item.text.trim();
  }

  confirmSelection(item) {
    if (!item) {
      return;
    }
    this.selectList.hide();
    this.didConfirmSelection(item);
  }

  scrollSelection(item) {
    if (!item) {
      return;
    }
    this.didScrollSelection(item);
  }

  destroy() {
    this.disposables.dispose();
    this.selectList.destroy();
  }
}

module.exports = { NavigationList };
