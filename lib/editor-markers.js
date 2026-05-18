const { getTextEditorHeaders } = require("./editor-adapter");

class EditorMarkers {
  constructor() {
    this.markerType = atom.config.get("navigation-panel.editor.markerType");
    this.markLines = atom.config.get("navigation-panel.editor.markLines");
    this.markerUserLevel = atom.config.get("navigation-panel.editor.markerUserLevel");
  }

  refresh(editor, headers) {
    this.clear(editor);
    if (!headers) {
      return;
    }
    this.refreshHeaders(editor, headers);
  }

  refreshHeaders(editor, headers) {
    if (!headers) {
      return;
    }
    for (const item of headers) {
      const deep = this.markerUserLevel ? item.level : item.revel;
      const layer = this.ensureLayer(editor, deep);
      if (layer) {
        layer.markRange([item.startPoint, item.endPoint], {
          exclusive: true,
          invalidate: "inside",
        });
        this.refreshHeaders(editor, item.children);
      }
    }
  }

  ensureLayer(editor, index) {
    const buffer = editor.getBuffer();
    if (!buffer.navigationMarkerLayers) {
      buffer.navigationMarkerLayers = {};
    }

    if (!buffer.navigationMarkerLayers[index]) {
      buffer.navigationMarkerLayers[index] = buffer.addMarkerLayer({
        role: `navigation-marker-${index}`,
      });
      for (const ed of atom.workspace.getTextEditors()) {
        if (ed.getBuffer() === buffer) {
          this.decorateLayer(ed, buffer.navigationMarkerLayers[index], index);
        }
      }
    }
    return buffer.navigationMarkerLayers[index];
  }

  decorateLayer(editor, layer, index) {
    for (const decoType of this.markerType.split("&")) {
      editor.decorateMarkerLayer(layer, {
        type: decoType,
        class: `navigation-marker-${index} navigation-marker ${decoType}-decoration`,
      });
    }
  }

  clear(editor) {
    if (!editor) {
      return;
    }
    const buffer = editor.getBuffer();
    if (!buffer.navigationMarkerLayers) {
      return;
    }
    for (const layer of Object.values(buffer.navigationMarkerLayers)) {
      layer.clear();
    }
  }

  forEditor(editor) {
    if (!editor) {
      return;
    }
    this.clear(editor);
    if (!this.markLines) {
      return;
    }
    const headers = getTextEditorHeaders(editor);
    this.refreshHeaders(editor, headers);
  }

  toggleLocal() {
    this.markLines = !this.markLines;
    for (const editor of atom.workspace.getTextEditors()) {
      this.forEditor(editor);
    }
  }
}

module.exports = { EditorMarkers };
