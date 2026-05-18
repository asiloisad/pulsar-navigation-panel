function foldSectionByRows(editor, startRow, endRow) {
  if (!canFold(editor)) {
    return;
  }
  editor.setSelectedBufferRange([
    [startRow, 1e10],
    [endRow, 1e10],
  ]);
  editor.foldSelectedLines();
}

function foldSectionAt(editor, headers, foldRevel) {
  if (!canFold(editor) || !headers) {
    return;
  }
  const curPos = editor.getCursorBufferPosition();
  let header1 = null;
  let header2 = null;
  const flatHeaders = getFlattenHeaders(headers);
  for (let i = flatHeaders.length - 1; i >= 0; i--) {
    if (
      flatHeaders[i].startPoint.row <= curPos.row &&
      (!foldRevel || (foldRevel && flatHeaders[i].revel === foldRevel))
    ) {
      header1 = flatHeaders[i];
      for (let j = i + 1; j < flatHeaders.length; j++) {
        if (flatHeaders[j].revel <= header1.revel) {
          header2 = flatHeaders[j];
          break;
        }
      }
      break;
    }
  }
  if (!header1) {
    return;
  }
  const startRow = header1.startPoint.row;
  const endRow = header2 ? header2.startPoint.row - 1 : editor.getLineCount();
  foldSectionByRows(editor, startRow, endRow);
}

function unfold(editor, headers) {
  if (!canFold(editor) || !headers || typeof editor.unfoldBufferRow !== "function") {
    return;
  }
  const currentRow = editor.getCursorBufferPosition().row;
  editor.unfoldBufferRow(currentRow);
  editor.scrollToCursorPosition();
}

function toggleSection(editor, headers) {
  if (!canFold(editor) || !headers || typeof editor.isFoldedAtBufferRow !== "function") {
    return;
  }
  const currentRow = editor.getCursorBufferPosition().row;
  if (editor.isFoldedAtBufferRow(currentRow)) {
    unfold(editor, headers);
  } else {
    foldSectionAt(editor, headers);
  }
}

function unfoldAll(editor, headers) {
  if (!canFold(editor) || !headers || typeof editor.unfoldBufferRow !== "function") {
    return;
  }
  const lastRow = editor.getLastBufferRow();
  for (let row = 0; row < lastRow; row++) {
    editor.unfoldBufferRow(row);
  }
  editor.scrollToCursorPosition();
}

function foldAsTable(editor, headers, naviClass = null) {
  if (!canFold(editor) || !headers) {
    return;
  }
  unfoldAll(editor, headers);
  const curPos = editor.getCursorBufferPosition();
  const lastRow = editor.getLastBufferRow();
  let header0 = null;
  const flatHeaders = getFlattenHeaders(headers);
  for (const header of flatHeaders) {
    if (!header0 && header.startPoint.row > 0) {
      editor.setSelectedBufferRange([
        [0, 0],
        [header.startPoint.row - 1, 1e10],
      ]);
      editor.foldSelectedLines();
    } else if (header0 && (!naviClass || header0.classList.includes(naviClass))) {
      foldSectionByRows(editor, header0.startPoint.row, header.startPoint.row - 1);
    }
    header0 = header;
  }
  if (header0) {
    foldSectionByRows(editor, header0.startPoint.row, lastRow);
  }
  editor.setCursorBufferPosition(curPos);
}

function getFlattenHeaders(headers) {
  const items = [];
  collectFlattenHeaders(items, headers);
  return items;
}

function collectFlattenHeaders(items, headers) {
  for (const item of headers || []) {
    items.push(item);
    collectFlattenHeaders(items, item.children);
  }
}

function canFold(editor) {
  return (
    editor &&
    typeof editor.getCursorBufferPosition === "function" &&
    typeof editor.setSelectedBufferRange === "function" &&
    typeof editor.foldSelectedLines === "function"
  );
}

module.exports = {
  foldSectionAt,
  foldAsTable,
  toggleSection,
  unfold,
  unfoldAll,
};
