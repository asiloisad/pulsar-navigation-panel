const { CompositeDisposable, Disposable } = require("atom");

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
  "source.typst": "./scanners/typst",
};

class EditorAdapter {
  constructor({ traceVisible = () => false } = {}) {
    this.traceVisible = traceVisible;
  }

  handlesItem(item) {
    return atom.workspace.isTextEditor(item);
  }

  observeHeaders(editor, callback) {
    const observer = new EditorHeaderObserver(editor, callback, {
      traceVisible: this.traceVisible,
    });
    return new Disposable(() => observer.destroy());
  }

  navigateTo(editor, header, options = {}) {
    if (!editor || !header || !header.startPoint) return;
    if (options.addCursor) {
      editor.addCursorAtBufferPosition([header.startPoint.row, 0]);
      return;
    }
    const focus = options.focus !== false;
    editor.setCursorBufferPosition([header.startPoint.row, 0], {
      autoscroll: false,
    });
    scrollToCursorWithMode(editor, atom.config.get("navigation-panel.editor.scrollPosition"));
    if (focus) {
      atom.views.getView(editor).focus();
    }
  }
}

class EditorHeaderObserver {
  constructor(editor, callback, { traceVisible }) {
    this.editor = editor;
    this.callback = callback;
    this.traceVisible = traceVisible;
    this.editorView = atom.views.getView(editor);
    this.scanner = createScanner(editor);
    this.disposables = new CompositeDisposable();
    this.headers = null;
    this.changedRanges = [];
    this.isUpdating = false;
    this.pendingUpdate = null;
    this.destroyed = false;
    this.lastScrollTop = undefined;
    this.updateVisibleItems = throttle(() => this.handleVisibleChange(), 50);

    this.subscribe();
    this.update({ instant: true });
  }

  destroy() {
    this.destroyed = true;
    this.disposables.dispose();
    this.disposeCursorState();
  }

  subscribe() {
    this.disposables.add(
      this.editor.getBuffer().onDidChange((event) => {
        this.changedRanges.push(event.newRange);
      }),
    );
    this.disposables.add(
      this.editor.onDidStopChanging(() => {
        const shouldScrollInstantly = this.changedRanges.some((range) =>
          this.isRangeVisible(range),
        );
        this.changedRanges = [];
        this.update({ instant: shouldScrollInstantly ? true : null });
      }),
    );
    this.disposables.add(
      this.editor.observeCursors((cursor) => {
        cursor.navigationItems = [];
        if (this.headers) {
          this.findCursorItems(cursor, cursor.getBufferPosition().row);
          this.emit();
        }
        cursor.navigationDisposeODCP = cursor.onDidChangePosition((event) => {
          if (event.oldBufferPosition === event.newBufferPosition || event.textChanged) {
            return;
          }
          this.clearCursorItems(cursor);
          this.findCursorItems(cursor, event.newBufferPosition.row);
          this.emit();
        });
        cursor.navigationDisposeODD = cursor.onDidDestroy(() => {
          this.clearCursorItems(cursor);
          cursor.navigationDisposeODCP.dispose();
          cursor.navigationDisposeODD.dispose();
          this.emit();
        });
      }),
    );
    this.disposables.add(
      this.editorView.onDidChangeScrollTop(() => {
        if (!this.traceVisible()) {
          return;
        }
        this.updateVisibleItems();
      }),
    );
    this.disposables.add(
      this.editor.onDidChangeGrammar(() => {
        this.scanner = createScanner(this.editor);
        this.update({ instant: true });
      }),
    );
  }

  async update(props) {
    if (this.isUpdating) {
      this.pendingUpdate = props;
      return;
    }

    this.isUpdating = true;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (this.destroyed) {
      this.isUpdating = false;
      return;
    }

    try {
      if (!this.scanner) {
        this.headers = null;
        this.emit(props);
        return;
      }

      let headers = this.scanner.getHeaders();
      if (headers instanceof Promise) {
        headers = await headers;
      }
      this.headers = headers;

      for (const cursor of this.editor.getCursors()) {
        this.clearCursorItems(cursor);
        this.findCursorItems(cursor, cursor.getBufferPosition().row);
      }
      this.markVisibleItems(this.editorView.getScrollTop());
      this.emit(props);
    } catch {
      /* ignore scanner errors */
    } finally {
      this.isUpdating = false;
      if (!this.destroyed && this.pendingUpdate) {
        const pending = this.pendingUpdate;
        this.pendingUpdate = null;
        this.update(pending);
      }
    }
  }

  emit(props) {
    if (this.destroyed) {
      return;
    }
    this.callback(this.headers, props);
  }

  isRangeVisible(range) {
    const firstVisibleScreenRow = this.editorView.getFirstVisibleScreenRow();
    const lastVisibleScreenRow = this.editorView.getLastVisibleScreenRow();
    const firstVisibleRow = this.editor.bufferRowForScreenRow(firstVisibleScreenRow);
    const lastVisibleRow = this.editor.bufferRowForScreenRow(lastVisibleScreenRow);
    return range.start.row <= lastVisibleRow && range.end.row >= firstVisibleRow;
  }

  clearCursorItems(cursor) {
    if (!cursor.navigationItems) {
      cursor.navigationItems = [];
    }
    if (cursor.navigationItems.length > 0) {
      cursor.navigationItems[0].currentCount -= 1;
      for (let item of cursor.navigationItems) {
        item.stackCount -= 1;
      }
    }
    cursor.navigationItems = [];
  }

  findCursorItems(cursor, cursorRow) {
    if (this.headers === null) {
      return;
    }
    this.lookupState(cursor.navigationItems, cursorRow, this.headers);
  }

  lookupState(navigationItems, cursorRow, headers) {
    for (let i = headers.length - 1; i >= 0; i--) {
      const item = headers[i];
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
  }

  handleVisibleChange() {
    if (!this.scanner || !this.headers) {
      return;
    }
    const scrollTop = this.editorView.getScrollTop();
    let direction = 0;
    if (this.lastScrollTop !== undefined) {
      direction = scrollTop - this.lastScrollTop;
    }
    this.lastScrollTop = scrollTop;
    this.markVisibleItems(scrollTop);
    this.emit({ scrollDirection: direction });
  }

  markVisibleItems(scrollTop) {
    if (!this.traceVisible() || !this.headers) {
      return;
    }
    const editorHeight = this.editorView.getHeight();
    if (!editorHeight || !this.editorView.getComponent()) {
      return;
    }
    let rowTop, rowBot;
    try {
      rowTop = this.editorView.screenPositionForPixelPosition({
        top: scrollTop,
        left: 0,
      }).row;
      rowBot = this.editorView.screenPositionForPixelPosition({
        top: scrollTop + editorHeight,
        left: 0,
      }).row;
    } catch {
      return;
    }
    setVisibleItem(this.editor, this.headers, rowTop, rowBot);
  }

  disposeCursorState() {
    for (const cursor of this.editor.getCursors()) {
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

function createScanner(editor) {
  if (!editor) return null;
  const scopeName = editor.getGrammar().scopeName;
  const scannerPath = SCANNERS[scopeName];
  const scannerName = scannerPath?.replace("./scanners/", "");
  if (!scannerPath || atom.config.get(`navigation-panel.scanners.${scannerName}`) === false) {
    return null;
  }
  const Scanner = Object.values(require(scannerPath))[0];
  return new Scanner(editor);
}

function getTextEditorHeaders(editor) {
  const scanner = createScanner(editor);
  return scanner ? scanner.getHeaders() : null;
}

function setVisibleItem(editor, headers, rowTop, rowBot) {
  if (!headers) {
    return;
  }
  for (const header of headers) {
    if (!header.startPoint) {
      continue;
    }
    const startRow = editor.screenPositionForBufferPosition([header.startPoint.row, 0]).row;
    const endRow = editor.screenPositionForBufferPosition([header.lastRow, 0]).row;
    if ((rowTop <= startRow && startRow <= rowBot) || (startRow <= rowTop && rowTop <= endRow)) {
      header.visibility = 1;
    } else {
      header.visibility = 0;
    }
    setVisibleItem(editor, header.children, rowTop, rowBot);
  }
}

function scrollToCursorWithMode(editor, scroll) {
  const [upper, lower] = scroll.split("-").map(Number);
  const editorView = atom.views.getView(editor);
  const cursorRow = editor.getCursorScreenPosition().row;
  const cursorPixel = editorView.component.pixelPositionAfterBlocksForRow(cursorRow);
  const viewHeight = editorView.component.getScrollContainerClientHeight();
  const margin = editorView.component.getVerticalAutoscrollMargin();
  const lineHeight = editorView.component.getLineHeight();
  const usable = viewHeight - 2 * margin - lineHeight;
  const toPixel = (pct) => margin + usable * (pct / 100);
  const upperPixel = toPixel(upper);
  if (lower === undefined) {
    editorView.setScrollTop(cursorPixel - upperPixel);
  } else {
    const currentScrollTop = editorView.getScrollTop();
    const cursorRelative = cursorPixel - currentScrollTop;
    const lowerPixel = toPixel(lower);
    if (cursorRelative < upperPixel) {
      editorView.setScrollTop(cursorPixel - upperPixel);
    } else if (cursorRelative > lowerPixel) {
      editorView.setScrollTop(cursorPixel - lowerPixel);
    }
  }
}

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

module.exports = {
  EditorAdapter,
  getTextEditorHeaders,
};
