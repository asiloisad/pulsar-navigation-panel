const path = require("path");

class ScannerImageEditor {
  constructor(editorView) {
    this.editorView = editorView;
  }

  getHeaders() {
    // Get file list from image-editor
    const fileList = this.editorView.getFileList();

    if (!fileList || !fileList.files || fileList.files.length === 0) {
      return [];
    }

    const currentPath = this.editorView.editor.getPath();

    // Convert file list to navigation panel header format
    const headers = fileList.files.map((filePath, index) => {
      const fileName = path.basename(filePath);
      const isCurrent = fileList.currentIndex === index;

      return {
        text: fileName,
        filePath: filePath,
        classList: [],
        currentCount: isCurrent ? 1 : 0,
        stackCount: isCurrent ? 1 : 0,
        visibility: 0,
        level: 0,
        revel: 0,
        children: [],
        // Store reference to editor for navigation
        editor: this.editorView.editor,
        editorView: this.editorView,
        // startPoint is required by navigation-panel
        startPoint: { row: index, column: 0 },
        endPoint: { row: index, column: fileName.length },
      };
    });

    return headers;
  }
}

module.exports = { ScannerImageEditor };
