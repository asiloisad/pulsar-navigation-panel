const { CompositeDisposable } = require("atom");
const { Disposable } = require("atom");
const { NavigationTree, scrollToCursorWithMode } = require("./navi-tree");

/**
 * Navigation Panel Package
 * Provides document outline navigation for multiple file types.
 * Supports LaTeX, Markdown, Python, JavaScript, C/C++, and more.
 * Features include header navigation, section folding, and visible markers.
 */
const SCANNERS = {
  "source.asciidoc": "./scanners/asciidoc",
  "text.bibtex": "./scanners/bibtex",
  "source.c": "./scanners/clike",
  "source.cs": "./scanners/clike",
  "source.cpp": "./scanners/clike",
  "source.js": "./scanners/javascript",
  "source.js.jsx": "./scanners/javascript",
  "source.ts": "./scanners/javascript",
  "source.tsx": "./scanners/javascript",
  "text.tex.latex": "./scanners/latex",
  "text.tex.latex.beamer": "./scanners/latex",
  "text.tex.latex.knitr": "./scanners/latex",
  "text.knitr": "./scanners/latex",
  "source.gfm": "./scanners/markdown",
  "text.md": "./scanners/markdown",
  "source.weave.md": "./scanners/markdown",
  "source.python": "./scanners/python",
  "source.cython": "./scanners/python",
  "text.restructuredtext": "./scanners/rest",
  "source.sofistik": "./scanners/sofistik",
  "text.tasklist": "./scanners/tasklist",
  "source.sinumerik": "./scanners/sinumerik",
};

module.exports = {
  /**
   * Activates the package and initializes the navigation tree.
   */
  activate() {
    this.disposables = new CompositeDisposable();
    this.onDidUpdateCallbacks = new Set();
    this.navigationTree = new NavigationTree();
    this.isUpdating = false;
    this.pendingUpdate = null;
    this.headers = null;
    this.editor = null;
    this.editorView = null;
    this.scanner = null;
    this.grammarDispose = null;
    this.editorDispose = null;
    this.cursorsDispose = null;
    this.outlineDispose = null;
    this.currentDispose = null;
    this.scrollDispose = null;
    this.currentHeaderIndex = -1;

    this.markerType = atom.config.get("navigation-panel.general.markerType");
    this.markLines = atom.config.get("navigation-panel.general.markLines");
    this.markerKind = atom.config.get("navigation-panel.general.markerKind");

    this.disposables.add(
      atom.commands.add("atom-workspace", {
        "navigation-panel:open":
          () => this.open(),
        "navigation-panel:open-and-split-down":
          () => this.open({ split: "down" }),
        "navigation-panel:hide":
          () => this.hide(),
        "navigation-panel:toggle":
          () => this.toggle(),
        "navigation-panel:next-header":
          () => this.navigateHeader(1),
        "navigation-panel:previous-header":
          () => this.navigateHeader(-1),
        "navigation-panel:fold-toggle":
          () => this.toggleSection(),
        "navigation-panel:fold-section":
          () => this.foldSectionAt(),
        "navigation-panel:fold-section-at-1":
          () => this.foldSectionAt(1),
        "navigation-panel:fold-section-at-2":
          () => this.foldSectionAt(2),
        "navigation-panel:fold-section-at-3":
          () => this.foldSectionAt(3),
        "navigation-panel:fold-section-at-4":
          () => this.foldSectionAt(4),
        "navigation-panel:fold-section-at-5":
          () => this.foldSectionAt(5),
        "navigation-panel:fold-section-at-6":
          () => this.foldSectionAt(6),
        "navigation-panel:fold-section-at-7":
          () => this.foldSectionAt(7),
        "navigation-panel:fold-section-at-8":
          () => this.foldSectionAt(8),
        "navigation-panel:fold-section-at-9":
          () => this.foldSectionAt(9),
        "navigation-panel:fold-as-table":
          () => this.foldAsTable(),
        "navigation-panel:fold-all-infos":
          () => this.foldAsTable("info"),
        "navigation-panel:fold-all-successes":
          () =>this.foldAsTable("success"),
        "navigation-panel:fold-all-warnings":
          () => this.foldAsTable("warning"),
        "navigation-panel:fold-all-errors":
          () => this.foldAsTable("error"),
        "navigation-panel:unfold":
          () => this.unfold(),
        "navigation-panel:unfold-all":
          () => this.unfoldAll(),
        "navigation-panel:markers-toggle":
          () => this.toggleMarkersLocal(),
      })
    );

    this.disposables.add(
      atom.config.observe("navigation-panel.general.traceVisible", (value) => {
        this.traceVisible = value;
        if (!value) {
          this.setVisibleItem(this.headers, -1, -1);
          this.setVisibleItemPdfjs(this.headers, []);
          this.navigationTree.update(this.headers);
        }
      })
    );

    this.disposables.add(
      atom.workspace.observeTextEditors((editor) => {
        const buffer = editor.getBuffer();
        if (!("navigationMarkerLayers" in buffer)) {
          buffer.navigationMarkerLayers = {};
        } else {
          // Decorate existing layers for this new editor
          for (const [index, layer] of Object.entries(
            buffer.navigationMarkerLayers
          )) {
            this.decorateMarkerLayer(editor, layer, index);
          }
        }
        this.markersForEditor(editor, this.markLines);
      })
    );

    this.disposables.add(
      atom.workspace.getCenter().observeActivePaneItem((item) => {
        if (!item) {
          this.grammarUnsubsribe();
          this.editorUnsubscribe();
          this.navigationTree.update(null);
        } else if (this.editor === item) {
          return;
        } else if ("pdfjsPath" in item) {
          this.grammarUnsubsribe();
          this.viewerSubscribe(item);
        } else if (this.isImageEditor(item)) {
          this.grammarUnsubsribe();
          this.imageEditorSubscribe(item);
        } else if (atom.workspace.isTextEditor(item)) {
          this.grammarUnsubsribe();
          this.grammarDispose = item.observeGrammar(() => {
            this.editorSubscribe(item);
          });
        }
      })
    );

    this.updateVisibleItems = throttle(() => {
      if (!this.scanner) {
        return;
      }
      let scrollTop = this.editorView.getScrollTop();
      let direction = 0;
      if (this.lastScrollTop !== undefined) {
        direction = scrollTop - this.lastScrollTop;
      }
      this.lastScrollTop = scrollTop;
      this.markVisibleItems(scrollTop);
      this.navigationTree.update(this.headers, { scrollDirection: direction });
    }, 50);
  },

  /**
   * Deactivates the package and cleans up resources.
   */
  deactivate() {
    for (let editor of atom.workspace.getTextEditors()) {
      this.clearMarkers(editor);
    }
    this.grammarUnsubsribe();
    this.editorUnsubscribe();
    this.navigationTree.destroy();
    this.disposables.dispose();
  },

  /**
   * Unsubscribes from grammar change events.
   */
  grammarUnsubsribe() {
    if (this.grammarDispose) {
      this.grammarDispose.dispose();
      this.grammarDispose = null;
    }
  },

  /**
   * Unsubscribes from editor-related events.
   */
  editorUnsubscribe() {
    if (this.scanner) {
      if (this.editorDispose) {
        this.editorDispose.dispose();
        this.editorDispose = null;
      }
      if (this.changeDispose) {
        this.changeDispose.dispose();
        this.changeDispose = null;
      }
      if (this.cursorsDispose) {
        this.cursorsDispose.dispose();
        this.cursorsDispose = null;
      }
      if (this.scrollDispose) {
        this.scrollDispose.dispose();
        this.scrollDispose = null;
      }
      if (this.editor && typeof this.editor.getCursors === "function") {
        for (let cursor of this.editor.getCursors()) {
          if (cursor.navigationDisposeODCP) {
            cursor.navigationDisposeODCP.dispose();
          }
          if (cursor.navigationDisposeODD) {
            cursor.navigationDisposeODD.dispose();
          }
          delete cursor.navigationItems;
        }
      }
    }
    if (this.outlineDispose) {
      this.outlineDispose.dispose();
      this.outlineDispose = null;
    }
    if (this.currentDispose) {
      this.currentDispose.dispose();
      this.currentDispose = null;
    }
    this.editor = null;
    this.editorView = null;
    this.scanner = null;
    this.headers = null;
  },

  /**
   * Subscribes to editor events and initializes the scanner.
   * @param {TextEditor} editor - The text editor to subscribe to
   */
  editorSubscribe(editor) {
    this.editorUnsubscribe();
    this.editor = editor;
    this.scanner = null;
    if (this.editor) {
      this.editorView = atom.views.getView(editor);
      let scopeName = this.editor.getGrammar().scopeName;
      if (scopeName in SCANNERS) {
        let Scanner = Object.values(require(SCANNERS[scopeName]))[0];
        this.scanner = new Scanner(this.editor);
        this.changedRanges = [];
        this.changeDispose = this.editor.getBuffer().onDidChange((event) => {
          this.changedRanges.push(event.newRange);
        });
        this.editorDispose = this.editor.onDidStopChanging(() => {
          // determine if changed ranges was visible (or not)
          // then scroll navi-tree (or not)
          const firstVisibleScreenRow = this.editorView.getFirstVisibleScreenRow();
          const lastVisibleScreenRow = this.editorView.getLastVisibleScreenRow();
          const firstVisibleRow = this.editor.bufferRowForScreenRow(
            firstVisibleScreenRow
          );
          const lastVisibleRow = this.editor.bufferRowForScreenRow(
            lastVisibleScreenRow
          );
          let update = false;
          for (let range of this.changedRanges) {
            if (
              range.start.row <= lastVisibleRow &&
              range.end.row >= firstVisibleRow
            ) {
              update = true;
              break;
            }
          }
          this.changedRanges = [];
          this.update({ instant: update ? true : null });
        });
        this.cursorsDispose = this.editor.observeCursors((cursor) => {
          cursor.navigationItems = [];
          if (this.headers) {
            // may by null
            this.findCursorItems(cursor, cursor.getBufferPosition().row);
            this.navigationTree.update(this.headers);
          }
          cursor.navigationDisposeODCP = cursor.onDidChangePosition((e) => {
            if (e.oldBufferPosition === e.newBufferPosition || e.textChanged) {
              return;
            }
            this.clearCursorItems(cursor);
            this.findCursorItems(cursor, e.newBufferPosition.row);
            this.navigationTree.update(this.headers);
          });
          cursor.navigationDisposeODD = cursor.onDidDestroy(() => {
            this.clearCursorItems(cursor);
            cursor.navigationDisposeODCP.dispose();
            cursor.navigationDisposeODD.dispose();
            this.navigationTree.update(this.headers);
          });
        });
        this.scrollDispose = this.editorView.onDidChangeScrollTop(() => {
          if (!this.traceVisible) {
            return;
          }
          this.updateVisibleItems();
        });
      }
    }
    this.update({ instant: true });
  },

  /**
   * Subscribes to PDF viewer events for navigation.
   * @param {Object} viewer - The PDF viewer instance
   */
  viewerSubscribe(viewer) {
    this.editorUnsubscribe();
    this.editor = viewer;
    const { ScannerPDFjs } = require("./scanners/pdfjs");
    let scanner = new ScannerPDFjs(this.editor);
    this.navigationTree.update([]);
    this.outlineDispose = viewer.observeOutline((outline) => {
      this.headers = scanner.getHeaders(outline);
      this.navigationTree.update(this.headers, { instant: true });
    });
    let startup = true;
    this.currentDispose = viewer.observeCurrent((destHashes) => {
      if (!this.headers) {
        return;
      }
      if (!this.traceVisible) {
        return;
      }
      // Ensure destHashes is an array
      const currentHashes = Array.isArray(destHashes)
        ? destHashes
        : [destHashes];

      // Mark visibility based on which sections are visible in the PDF viewer
      this.setVisibleItemPdfjs(this.headers, currentHashes);
      this.navigationTree.update(this.headers, { instant: startup });
      startup = false;
    });
  },

  /**
   * Checks if an item is an image editor.
   * @param {Object} item - The workspace item to check
   * @returns {boolean} True if the item is an image editor
   */
  isImageEditor(item) {
    const result =
      item &&
      typeof item.getEncodedURI === "function" &&
      typeof item.load === "function" &&
      item.file !== undefined;
    return result;
  },

  /**
   * Subscribes to image editor events for navigation.
   * @param {Object} imageEditor - The image editor instance
   */
  imageEditorSubscribe(imageEditor) {
    this.editorUnsubscribe();
    this.editor = imageEditor;
    // Get the view from the editor
    this.editorView = imageEditor.view;
    if (!this.editorView) {
      return;
    }

    const { ScannerImageEditor } = require("./scanners/image-editor");
    this.scanner = new ScannerImageEditor(this.editorView);

    const headers = this.scanner.getHeaders();

    // Subscribe to image updates to refresh the file list
    this.editorDispose = new CompositeDisposable();

    // Listen for image changes to update the current file marker
    this.editorDispose.add(
      imageEditor.onDidChange(() => {
        this.update({ instant: true });
      })
    );

    // Listen for file replacements (when navigating between images)
    this.editorDispose.add(
      imageEditor.onDidReplaceFile(() => {
        this.update({ instant: true });
      })
    );

    this.update({ instant: true });
  },

  /**
   * Opens the navigation panel.
   * @param {Object} [userOptions] - Optional options for opening
   */
  open(userOptions) {
    let previouslyFocusedElement = document.activeElement;
    let options = {
      location: atom.config.get("navigation-panel.general.defaultSide"),
      searchAllPanes: true,
    };
    atom.workspace
      .open(this.navigationTree, { ...options, ...userOptions })
      .then(() => {
        previouslyFocusedElement.focus();
      });
  },

  /**
   * Hides the navigation panel.
   */
  hide() {
    let previouslyFocusedElement = document.activeElement;
    atom.workspace.hide(this.navigationTree);
    previouslyFocusedElement.focus();
  },

  /**
   * Toggles the navigation panel visibility.
   */
  toggle() {
    let previouslyFocusedElement = document.activeElement;
    atom.workspace.toggle(this.navigationTree).then(() => {
      previouslyFocusedElement.focus();
      this.navigationTree.instant = true;
      this.navigationTree.scrollToCurrent();
    });
  },

  /**
   * Updates the navigation tree with current headers.
   * @param {Object} [props] - Update options
   */
  async update(props) {
    if (this.isUpdating) {
      this.pendingUpdate = props;
      return;
    }

    this.isUpdating = true;
    await new Promise((resolve) => requestAnimationFrame(resolve));

    try {
      if (!this.scanner) {
        this.navigationTree.update(null);
      } else {
        try {
          let headers = this.scanner.getHeaders();
          if (headers instanceof Promise) {
            headers = await headers;
          }
          this.headers = headers;

          // Only process cursors for text editors
          if (this.editor && typeof this.editor.getCursors === "function") {
            for (let cursor of this.editor.getCursors()) {
              this.clearCursorItems(cursor);
              this.findCursorItems(cursor, cursor.getBufferPosition().row);
            }
          }

          // Only mark visible items if we have the necessary methods
          if (
            this.editorView &&
            typeof this.editorView.getScrollTop === "function"
          ) {
            this.markVisibleItems(this.editorView.getScrollTop());
          }

          this.navigationTree.update(this.headers, props);

          if (this.markLines && typeof this.editor.getBuffer === "function") {
            this.refreshMarkers();
          } else if (typeof this.editor.getBuffer === "function") {
            this.clearMarkers(this.editor);
          }
        } catch (err) {}
      }
      for (let callback of this.onDidUpdateCallbacks) {
        callback(this.editor, this.headers);
      }
    } finally {
      this.isUpdating = false;
      if (this.pendingUpdate) {
        let p = this.pendingUpdate;
        this.pendingUpdate = null;
        this.update(p);
      }
    }
  },

  /**
   * Registers a callback for header update events.
   * @param {Function} callback - The callback function
   * @returns {Disposable} Disposable to unregister the callback
   */
  onDidUpdateHeaders(callback) {
    this.onDidUpdateCallbacks.add(callback);
    return new Disposable(() => {
      this.onDidUpdateCallbacks.delete(callback);
    });
  },

  /**
   * Observes headers and invokes callback on changes.
   * @param {Function} callback - The callback function
   * @returns {Disposable} Disposable to stop observing
   */
  observeHeaders(callback) {
    // callback(this.editor, this.headers);
    return this.onDidUpdateHeaders(callback);
  },

  clearCursorItems(cursor) {
    if (cursor.navigationItems.length > 0) {
      cursor.navigationItems[0].currentCount -= 1;
      for (let item of cursor.navigationItems) {
        item.stackCount -= 1;
      }
    }
    cursor.navigationItems = [];
  },

  findCursorItems(cursor, cursorRow) {
    if (this.headers === null) {
      return;
    }
    this.lookupState(cursor.navigationItems, cursorRow, this.headers);
  },

  lookupState(navigationItems, cursorRow, headers) {
    for (var i = headers.length - 1; i >= 0; i--) {
      var item = headers[i];
      if (item.startPoint.row <= cursorRow) {
        this.lookupState(navigationItems, cursorRow, item.children);
        if (navigationItems.length === 0) {
          item.currentCount += 1;
        }
        item.stackCount += 1;
        navigationItems.push(item);
        break;
      }
    }
  },

  markVisibleItems(scrollTop) {
    if (this.traceVisible && this.headers) {
      let editorHeight = this.editorView.getHeight();
      if (!editorHeight) {
        return;
      }
      let rowTop = this.editorView.screenPositionForPixelPosition({
        top: scrollTop,
        left: 0,
      }).row;
      let rowBot = this.editorView.screenPositionForPixelPosition({
        top: scrollTop + editorHeight,
        left: 0,
      }).row;
      this.setVisibleItem(this.headers, rowTop, rowBot);
    }
  },

  setVisibleItem(headers, rowTop, rowBot) {
    if (!headers) {
      return;
    }
    for (let header of headers) {
      if (!header.startPoint) {
        continue;
      }
      let startRow = this.editor.screenPositionForBufferPosition([
        header.startPoint.row,
        0,
      ]).row;
      let endRow = this.editor.screenPositionForBufferPosition([
        header.lastRow,
        0,
      ]).row;
      if (
        (rowTop <= startRow && startRow <= rowBot) ||
        (startRow <= rowTop && rowTop <= endRow)
      ) {
        header.visibility = 1;
      } else {
        header.visibility = 0;
      }
      this.setVisibleItem(header.children, rowTop, rowBot);
    }
  },

  /**
   * Sets visibility for PDF.js outline items based on visible destination hashes.
   * @param {Array} headers - The header items to process
   * @param {Array} visibleHashes - Array of destination hashes currently visible
   */
  setVisibleItemPdfjs(headers, visibleHashes) {
    if (!headers) {
      return;
    }
    for (let header of headers) {
      // Only mark visible if this item's destHash is directly in visible hashes
      header.visibility = visibleHashes.includes(header.destHash) ? 1 : 0;
      this.setVisibleItemPdfjs(header.children, visibleHashes);
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

  foldSectionByRows(startRow, endRow) {
    this.editor.setSelectedBufferRange([
      [startRow, 1e10],
      [endRow, 1e10],
    ]);
    this.editor.foldSelectedLines();
  },

  foldSectionAt(foldRevel) {
    if (!this.headers) {
      return;
    }
    let curPos = this.editor.getCursorBufferPosition();
    let header1 = null;
    let header2 = null;
    let headers = this.getFlattenHeaders();
    for (var i = headers.length - 1; i >= 0; i--) {
      if (
        headers[i].startPoint.row <= curPos.row &&
        (!foldRevel || (foldRevel && headers[i].revel === foldRevel))
      ) {
        header1 = headers[i];
        for (var j = i + 1; j < headers.length; j++) {
          if (headers[j].revel <= header1.revel) {
            header2 = headers[j];
            break;
          }
        }
        break;
      }
    }
    let startRow, endRow;
    if (!header1) {
      return;
    } else {
      startRow = header1.startPoint.row;
    }
    if (!header2) {
      endRow = this.editor.getLineCount();
    } else {
      endRow = header2.startPoint.row - 1;
    }
    this.foldSectionByRows(startRow, endRow);
  },

  unfold() {
    if (!this.headers) {
      return;
    }
    const currentRow = this.editor.getCursorBufferPosition().row;
    this.editor.unfoldBufferRow(currentRow);
    this.editor.scrollToCursorPosition();
  },

  toggleSection() {
    if (!this.headers) {
      return;
    }
    const currentRow = this.editor.getCursorBufferPosition().row;
    if (this.editor.isFoldedAtBufferRow(currentRow)) {
      this.unfold();
    } else {
      this.foldSectionAt();
    }
  },

  unfoldAll() {
    if (!this.headers) {
      return;
    }
    let lrow = this.editor.getLastBufferRow();
    for (let row = 0; row < lrow; row++) {
      this.editor.unfoldBufferRow(row);
    }
    this.editor.scrollToCursorPosition();
  },

  foldAsTable(naviClass = null) {
    if (!this.headers) {
      return;
    }
    this.unfoldAll();
    let curPos = this.editor.getCursorBufferPosition();
    let lastRow = this.editor.getLastBufferRow();
    let header0 = null;
    let headers = this.getFlattenHeaders();
    for (var header of headers) {
      if (!header0 && header.startPoint.row > 0) {
        this.editor.setSelectedBufferRange([
          [0, 0],
          [header.startPoint.row - 1, 1e10],
        ]);
        this.editor.foldSelectedLines();
      } else if (
        header0 &&
        (!naviClass || header0.classList.includes(naviClass))
      ) {
        this.foldSectionByRows(
          header0.startPoint.row,
          header.startPoint.row - 1
        );
      }
      header0 = header;
    }
    this.foldSectionByRows(header.startPoint.row, lastRow);
    this.editor.setCursorBufferPosition(curPos);
  },

  refreshMarkers() {
    this.clearMarkers(this.editor);
    this._refreshMarkers(this.editor, this.headers);
  },

  _refreshMarkers(editor, headers) {
    const buffer = editor.getBuffer();
    for (var item of headers) {
      let deep = this.markerKind ? item.level : item.revel;
      let layer = this.ensureMarkerLayer(editor, deep);
      if (layer) {
        layer.markRange([item.startPoint, item.endPoint], {
          exclusive: true,
          invalidate: "inside",
        });
        this._refreshMarkers(editor, item.children);
      }
    }
  },

  ensureMarkerLayer(editor, index) {
    const buffer = editor.getBuffer();
    if (!buffer.navigationMarkerLayers) {
      buffer.navigationMarkerLayers = {};
    }

    if (!buffer.navigationMarkerLayers[index]) {
      buffer.navigationMarkerLayers[index] = buffer.addMarkerLayer({
        role: `navigation-marker-${index}`,
      });
      // Decorate this new layer for all editors of this buffer
      for (let ed of atom.workspace.getTextEditors()) {
        if (ed.getBuffer() === buffer) {
          this.decorateMarkerLayer(
            ed,
            buffer.navigationMarkerLayers[index],
            index
          );
        }
      }
    }
    return buffer.navigationMarkerLayers[index];
  },

  decorateMarkerLayer(editor, layer, index) {
    for (let decoType of this.markerType.split("&")) {
      editor.decorateMarkerLayer(layer, {
        type: decoType,
        class: `navigation-marker-${index} navigation-marker ${decoType}-decoration`,
      });
    }
  },

  clearMarkers(editor) {
    const buffer = editor.getBuffer();
    for (const layer of Object.values(buffer.navigationMarkerLayers)) {
      layer.clear();
    }
  },

  markersForEditor(editor, mode) {
    if (!editor) {
      return;
    }
    this.clearMarkers(editor);
    if (!mode) {
      return;
    }
    let scopeName = editor.getGrammar().scopeName;
    if (!(scopeName in SCANNERS)) {
      return;
    }
    let Scanner = Object.values(require(SCANNERS[scopeName]))[0];
    let scanner = new Scanner(editor);
    let headers = scanner.getHeaders();
    this._refreshMarkers(editor, headers);
  },

  toggleMarkersLocal() {
    this.markLines = !this.markLines;
    for (const editor of atom.workspace.getTextEditors()) {
      this.markersForEditor(editor, this.markLines);
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

  _collectVisibleHeaders(items, headers) {
    for (const header of headers) {
      // Check if header should be visible based on category filters
      let visible = true;
      if (header.classList) {
        if (
          header.classList.includes("info") &&
          !atom.config.get("navigation-panel.categories.info")
        )
          visible = false;
        if (
          header.classList.includes("success") &&
          !atom.config.get("navigation-panel.categories.success")
        )
          visible = false;
        if (
          header.classList.includes("warning") &&
          !atom.config.get("navigation-panel.categories.warning")
        )
          visible = false;
        if (
          header.classList.includes("error") &&
          !atom.config.get("navigation-panel.categories.error")
        )
          visible = false;
        if (
          header.classList.length === 0 &&
          !atom.config.get("navigation-panel.categories.standard")
        )
          visible = false;
      }

      if (visible) {
        items.push(header);
        if (header.children && header.children.length > 0) {
          this._collectVisibleHeaders(items, header.children);
        }
      }
    }
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

  navigateToHeader(item) {
    if (!item) return;

    if (item.viewer) {
      item.viewer.scrollToDestination(item);
      atom.views.getView(item.viewer).focus();
    } else if (item.editor && item.startPoint) {
      item.editor.setCursorBufferPosition([item.startPoint.row, 0], {
        autoscroll: false,
      });
      scrollToCursorWithMode(
        item.editor,
        atom.config.get("navigation-panel.general.centerScroll")
      );
      atom.views.getView(item.editor).focus();
    }
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

/**
 * Creates a throttled version of a function.
 * @param {Function} func - The function to throttle
 * @param {number} timeout - The throttle timeout in milliseconds
 * @returns {Function} The throttled function
 */
function throttle(func, timeout) {
  let timer = false;
  return (...args) => {
    if (timer) {
      return;
    }
    timer = setTimeout(() => {
      func.apply(this, args);
      timer = false;
    }, timeout);
  };
}
