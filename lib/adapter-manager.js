const { Disposable } = require("atom");

class AdapterManager {
  constructor() {
    this.registry = new Set();
    this.active = null;
    this._headersDispose = null;
  }

  consume(adapter) {
    this.registry.add(adapter);
    return new Disposable(() => this.registry.delete(adapter));
  }

  getForItem(item) {
    for (const adapter of this.registry) {
      if (adapter.handlesItem?.(item)) return adapter;
    }
    return null;
  }

  subscribe(adapter, item, { onHeaders }) {
    this.unsubscribe();
    this.active = adapter;

    this._headersDispose = adapter.observeHeaders(item, onHeaders);
  }

  unsubscribe() {
    if (this._headersDispose) {
      this._headersDispose.dispose();
      this._headersDispose = null;
    }
    this.active = null;
  }

  buildHeaders(rawHeaders, paneItem) {
    if (!Array.isArray(rawHeaders)) return null;
    if (!isAdapterTree(rawHeaders)) return null;
    const adapter = this.active;
    if (!adapter) return null;
    const traceByVisibility = hasAdapterVisibility(rawHeaders);
    return augmentAdapterItems(rawHeaders, paneItem, adapter, traceByVisibility);
  }
}

function isAdapterTree(items) {
  return items.every(
    (item) => item && Array.isArray(item.children) && isAdapterTree(item.children),
  );
}

function hasAdapterVisibility(items) {
  return items.some(
    (item) =>
      item &&
      (item.visible !== undefined ||
        item.visibility !== undefined ||
        hasAdapterVisibility(Array.isArray(item.children) ? item.children : [])),
  );
}

function augmentAdapterItems(items, paneItem, adapter, traceByVisibility, revel = 1) {
  const maxDepth = atom.config.get("navigation-panel.editor.maxHeadingDepth");
  if (maxDepth < revel) return [];

  return items.map((item, index) => {
    const source = item || {};
    const startPoint = source.startPoint || { row: index, column: 0 };
    const header = {
      ...source,
      text: String(source.text || "").trim(),
      level: source.level ?? revel,
      revel,
      classList: Array.isArray(source.classList) ? source.classList : [],
      children: augmentAdapterItems(
        Array.isArray(source.children) ? source.children : [],
        paneItem,
        adapter,
        traceByVisibility,
        revel + 1,
      ),
      startPoint,
      endPoint: source.endPoint || startPoint,
      lastRow: source.lastRow ?? startPoint.row,
      currentCount: source.currentCount ?? (source.current ? 1 : 0),
      stackCount: source.stackCount ?? (source.active || source.current ? 1 : 0),
      visibility: source.visibility ?? (source.visible ? 1 : 0),
      traceByVisibility,
    };
    header.navigate = (options) => adapter.navigateTo(paneItem, header, options);
    return header;
  });
}

module.exports = { AdapterManager };
