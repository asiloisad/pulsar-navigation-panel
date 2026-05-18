const { CompositeDisposable, Disposable } = require("atom");
const { AdapterManager } = require("./adapter-manager");
const { EditorAdapter } = require("./editor-adapter");
const EditorFolds = require("./editor-folds");
const { NavigationList } = require("./navi-list");
const { EditorMarkers } = require("./editor-markers");
const { NavigationTree } = require("./navi-tree");

module.exports = {
  activate() {
    this.disposables = new CompositeDisposable();
    this.onDidUpdateCallbacks = new Set();
    this.navigationTree = new NavigationTree();
    this.navigationList = new NavigationList({
      getItems: () => this.getVisibleHeaderListItems(),
      hasHeaders: () => Boolean(this.headers),
      didConfirmSelection: (item) => this.navigateToHeader(item),
      didScrollSelection: (item) => this.navigateToHeader(item, { focus: false }),
    });
    this.headers = null;
    this.editor = null;
    this.currentHeaderIndex = -1;
    this.adapterManager = new AdapterManager();
    this.markers = new EditorMarkers();
    this.builtinEditorAdapter = new EditorAdapter({
      traceVisible: () => this.traceVisible,
      markers: this.markers,
    });
    const foldSection = (level) => EditorFolds.foldSectionAt(this.editor, this.headers, level);
    const foldAsTable = (className) =>
      EditorFolds.foldAsTable(this.editor, this.headers, className);

    this.disposables.add(
      atom.commands.add("atom-workspace", {
        "navigation-panel:open": () => this.open(),
        "navigation-panel:open-and-split-down": () => this.open({ split: "down" }),
        "navigation-panel:hide": () => this.hide(),
        "navigation-panel:toggle": () => this.toggle(),
        "navigation-panel:toggle-focus": () => this.toggleFocus(),
        "navigation-panel:list": () => this.list(),
        "navigation-panel:next-header": () => this.navigateHeader(1),
        "navigation-panel:previous-header": () => this.navigateHeader(-1),
        "navigation-panel:fold-toggle": () => EditorFolds.toggleSection(this.editor, this.headers),
        "navigation-panel:fold-section": () => foldSection(),
        "navigation-panel:fold-section-at-1": () => foldSection(1),
        "navigation-panel:fold-section-at-2": () => foldSection(2),
        "navigation-panel:fold-section-at-3": () => foldSection(3),
        "navigation-panel:fold-section-at-4": () => foldSection(4),
        "navigation-panel:fold-section-at-5": () => foldSection(5),
        "navigation-panel:fold-section-at-6": () => foldSection(6),
        "navigation-panel:fold-section-at-7": () => foldSection(7),
        "navigation-panel:fold-section-at-8": () => foldSection(8),
        "navigation-panel:fold-section-at-9": () => foldSection(9),
        "navigation-panel:fold-as-table": () => foldAsTable(),
        "navigation-panel:fold-all-infos": () => foldAsTable("info"),
        "navigation-panel:fold-all-successes": () => foldAsTable("success"),
        "navigation-panel:fold-all-warnings": () => foldAsTable("warning"),
        "navigation-panel:fold-all-errors": () => foldAsTable("error"),
        "navigation-panel:unfold": () => EditorFolds.unfold(this.editor, this.headers),
        "navigation-panel:unfold-all": () => EditorFolds.unfoldAll(this.editor, this.headers),
        "navigation-panel:markers-toggle": () => this.markers.toggleLocal(),
      }),
    );

    this.disposables.add(
      atom.config.observe("navigation-panel.panel.traceVisible", (value) => {
        this.traceVisible = value;
        if (!value) {
          this.setVisibleItemByPredicate(this.headers, () => false);
          this.navigationTree.update(this.headers);
        }
      }),
    );

    this.disposables.add(
      atom.workspace.observeTextEditors((editor) => {
        const buffer = editor.getBuffer();
        if (!("navigationMarkerLayers" in buffer)) {
          buffer.navigationMarkerLayers = {};
        } else {
          // Decorate existing layers for this new editor
          for (const [index, layer] of Object.entries(buffer.navigationMarkerLayers)) {
            this.markers.decorateLayer(editor, layer, index);
          }
        }
        this.markers.forEditor(editor);
      }),
    );

    this.disposables.add(
      atom.workspace.getCenter().observeActivePaneItem((item) => {
        if (!item) {
          this.unsubscribe();
          this.navigationTree.update(null);
        } else if (this.editor === item) {
          return;
        } else if (this.adapterManager.getForItem(item)) {
          this.adapterSubscribe(this.adapterManager.getForItem(item), item);
        } else if (atom.workspace.isTextEditor(item)) {
          this.adapterSubscribe(this.builtinEditorAdapter, item);
        } else {
          this.unsubscribe();
          this.navigationTree.update(null);
        }
      }),
    );
  },

  deactivate() {
    for (let editor of atom.workspace.getTextEditors()) {
      this.markers.clear(editor);
    }
    this.unsubscribe();
    this.navigationList.destroy();
    this.navigationTree.destroy();
    this.disposables.dispose();
  },

  unsubscribe() {
    this.adapterManager.unsubscribe();
    this.editor = null;
    this.headers = null;
    this.navigationList.markDirty();
  },

  consumeNavigationAdapter(adapter) {
    const item = atom.workspace.getCenter().getActivePaneItem();
    if (item && adapter.handlesItem?.(item)) {
      this.adapterSubscribe(adapter, item);
    }
    return this.adapterManager.consume(adapter);
  },

  adapterSubscribe(adapter, item) {
    this.unsubscribe();
    this.editor = item;
    this.headers = null;
    this.navigationList.markDirty();
    this.navigationTree.update(null, { instant: true });
    this.adapterManager.subscribe(adapter, item, {
      onHeaders: (headers, options) => {
        if (this.editor !== item || this.adapterManager.active !== adapter) return;
        this.updateAdapterHeaders(headers, options);
      },
    });
  },

  updateAdapterHeaders(rawHeaders, props = { instant: true }) {
    this.headers = this.adapterManager.buildHeaders(rawHeaders, this.editor);
    this.navigationList.markDirty();
    this.navigationTree.update(this.headers, props);

    if (
      atom.workspace.isTextEditor(this.editor) &&
      !this.adapterManager.active?.managesEditorMarkers
    ) {
      if (this.markers.markLines && this.headers) {
        this.markers.refresh(this.editor, this.headers);
      } else {
        this.markers.clear(this.editor);
      }
    }

    for (let callback of this.onDidUpdateCallbacks) {
      callback(this.editor, this.headers);
    }
  },

  open(userOptions) {
    let options = {
      location: atom.config.get("navigation-panel.panel.defaultSide"),
      searchAllPanes: true,
    };
    atom.workspace.open(this.navigationTree, { ...options, ...userOptions }).then(() => {
      this.navigationTree.focusHeaderList();
    });
  },

  hide() {
    let previouslyFocusedElement = document.activeElement;
    atom.workspace.hide(this.navigationTree);
    previouslyFocusedElement.focus();
  },

  toggle() {
    let previouslyFocusedElement = document.activeElement;
    atom.workspace.toggle(this.navigationTree).then(() => {
      previouslyFocusedElement.focus();
      this.navigationTree.instant = true;
      this.navigationTree.scrollToCurrent();
    });
  },

  toggleFocus() {
    const el = this.navigationTree.element;
    const isVisible = el && (el.offsetWidth !== 0 || el.offsetHeight !== 0);
    if (!isVisible) {
      this.open();
    } else if (el.contains(document.activeElement)) {
      atom.workspace.getCenter().activate();
    } else {
      this.navigationTree.focusHeaderList();
    }
  },

  list() {
    this.navigationList.toggle();
  },

  onDidUpdateHeaders(callback) {
    this.onDidUpdateCallbacks.add(callback);
    return new Disposable(() => {
      this.onDidUpdateCallbacks.delete(callback);
    });
  },

  observeHeaders(callback) {
    callback(this.editor, this.headers);
    return this.onDidUpdateHeaders(callback);
  },

  setVisibleItemByPredicate(headers, isVisible) {
    if (!headers) return;
    for (const header of headers) {
      header.visibility = isVisible(header) ? 1 : 0;
      this.setVisibleItemByPredicate(header.children, isVisible);
    }
  },

  getFlattenHeaders() {
    let items = [];
    if (this.headers) {
      this._getFlattenHeaders(items, this.headers);
    }
    return items;
  },

  _getFlattenHeaders(items, headers) {
    for (let item of headers) {
      items.push(item);
      this._getFlattenHeaders(items, item.children);
    }
  },

  navigateHeader(direction) {
    const visibleHeaders = this.getVisibleHeadersFromTree();
    if (!visibleHeaders.length) return;

    // Initialize or update current index
    if (this.currentHeaderIndex === -1) {
      // Find the current header based on cursor position
      this.currentHeaderIndex = this.findCurrentHeaderIndex(visibleHeaders);
      if (this.currentHeaderIndex === -1) {
        this.currentHeaderIndex = direction > 0 ? 0 : visibleHeaders.length - 1;
      }
    } else {
      // Move to next/previous header
      this.currentHeaderIndex += direction;

      // Wrap around
      if (this.currentHeaderIndex >= visibleHeaders.length) {
        this.currentHeaderIndex = 0;
      } else if (this.currentHeaderIndex < 0) {
        this.currentHeaderIndex = visibleHeaders.length - 1;
      }
    }

    // Navigate to the selected header
    const header = visibleHeaders[this.currentHeaderIndex];
    if (header) {
      this.navigateToHeader(header);
    }
  },

  getVisibleHeadersFromTree() {
    if (!this.headers) return [];
    const items = [];
    this._collectVisibleHeaders(items, this.headers);
    return items;
  },

  getVisibleHeaderListItems() {
    if (!this.headers) return [];
    const items = [];
    this._collectVisibleHeaderListItems(items, this.headers, []);
    return items;
  },

  _collectVisibleHeaderListItems(items, headers, parents) {
    for (const header of headers) {
      const visible = this.isHeaderVisible(header);
      const path = [...parents, header.text.trim()].filter(Boolean);

      if (visible) {
        items.push({
          ...header,
          text: path.join(" > "),
          children: [],
        });
      }

      if (header.children && header.children.length > 0) {
        this._collectVisibleHeaderListItems(items, header.children, path);
      }
    }
  },

  _collectVisibleHeaders(items, headers) {
    for (const header of headers) {
      const visible = this.isHeaderVisible(header);

      if (visible) {
        items.push(header);
        if (header.children && header.children.length > 0) {
          this._collectVisibleHeaders(items, header.children);
        }
      }
    }
  },

  isHeaderVisible(header) {
    if (!header.classList) return true;
    const t = this.navigationTree;
    if (header.classList.includes("info") && !t.info) return false;
    if (header.classList.includes("success") && !t.success) return false;
    if (header.classList.includes("warning") && !t.warning) return false;
    if (header.classList.includes("error") && !t.error) return false;
    if (header.classList.length === 0 && !t.standard) return false;
    return true;
  },

  findCurrentHeaderIndex(visibleHeaders) {
    if (!this.editor) return -1;
    const currentRow = this.editor.getCursorBufferPosition().row;

    for (let i = 0; i < visibleHeaders.length; i++) {
      const item = visibleHeaders[i];
      if (item.startPoint && item.startPoint.row === currentRow) {
        return i;
      }
    }

    return -1;
  },

  navigateToHeader(item, options = {}) {
    if (!item || !item.navigate) return;
    item.navigate(options);
  },

  serviceProvider() {
    return {
      getEditor: () => {
        return this.editor;
      },
      getFlattenHeaders: () => {
        return this.getFlattenHeaders();
      },
      onDidUpdateHeaders: (callback) => {
        return this.onDidUpdateHeaders(callback);
      },
      observeHeaders: (callback) => {
        return this.observeHeaders(callback);
      },
    };
  },
};
