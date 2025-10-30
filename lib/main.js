const { CompositeDisposable } = require('atom')
const { Disposable } = require('atom')
const { NavigationTree } = require('./navi-tree')
const { ScannerAsciiDoc } = require('./scanners/asciidoc')
const { ScannerBibtex } = require('./scanners/bibtex')
const { ScannerClike } = require('./scanners/clike')
const { ScannerLatex } = require('./scanners/latex')
const { ScannerMarkdown } = require('./scanners/markdown')
const { ScannerPython } = require('./scanners/python')
const { ScannerRest } = require('./scanners/rest')
const { ScannerSofistik } = require('./scanners/sofistik')
const { ScannerTasklist } = require('./scanners/tasklist')
const { ScannerPDFjs } = require('./scanners/pdfjs')
const { ScannerSinumerik } = require('./scanners/sinumerik')

const SCANNERS = {
  'source.asciidoc': ScannerAsciiDoc,
  'text.bibtex': ScannerBibtex,
  'source.c': ScannerClike,
  'source.cs': ScannerClike,
  'source.cpp': ScannerClike,
  'text.tex.latex': ScannerLatex,
  'text.tex.latex.beamer': ScannerLatex,
  'text.tex.latex.knitr': ScannerLatex,
  'text.knitr': ScannerLatex,
  'source.gfm': ScannerMarkdown,
  'text.md': ScannerMarkdown,
  'source.weave.md': ScannerMarkdown,
  'python': ScannerPython,
  'source.python': ScannerPython,
  'source.cython': ScannerPython,
  'text.restructuredtext': ScannerRest,
  'source.sofistik': ScannerSofistik,
  'text.tasklist': ScannerTasklist,
  'source.sinumerik': ScannerSinumerik,
}

module.exports = {

  activate() {
    this.disposables = new CompositeDisposable()
    this.subscription = Promise.resolve()
    this.navigationTree = new NavigationTree()
    this.headers = null
    this.editor = null
    this.editorView = null
    this.scanner = null
    this.grammarDispose = null
    this.editorDispose = null
    this.cursorsDispose = null
    this.outlineDispose = null
    this.currentDispose = null
    this.scrollDispose = null

    this.markerType = atom.config.get('navigation-panel.general.markerType')
    this.markLines = atom.config.get('navigation-panel.general.markLines')
    this.markerKind = atom.config.get('navigation-panel.general.markerKind')

    this.disposables.add(atom.commands.add('atom-workspace', {
      'navigation-panel:open': () => this.open(),
      'navigation-panel:open-and-split-down': () => this.open({ split:'down' }),
      'navigation-panel:hide': () => this.hide(),
      'navigation-panel:toggle': () => this.toggle(),
      'navigation-panel:fold-toggle': () => this.toggleSection(),
      'navigation-panel:fold-section': () => this.foldSectionAt(),
      'navigation-panel:fold-section-at-1': () => this.foldSectionAt(1),
      'navigation-panel:fold-section-at-2': () => this.foldSectionAt(2),
      'navigation-panel:fold-section-at-3': () => this.foldSectionAt(3),
      'navigation-panel:fold-section-at-4': () => this.foldSectionAt(4),
      'navigation-panel:fold-section-at-5': () => this.foldSectionAt(5),
      'navigation-panel:fold-section-at-6': () => this.foldSectionAt(6),
      'navigation-panel:fold-section-at-7': () => this.foldSectionAt(7),
      'navigation-panel:fold-section-at-8': () => this.foldSectionAt(8),
      'navigation-panel:fold-section-at-9': () => this.foldSectionAt(9),
      'navigation-panel:fold-as-table': () => this.foldAsTable(),
      'navigation-panel:fold-all-infos': () => this.foldAsTable('info'),
      'navigation-panel:fold-all-successes': () => this.foldAsTable('success'),
      'navigation-panel:fold-all-warnings': () => this.foldAsTable('warning'),
      'navigation-panel:fold-all-errors': () => this.foldAsTable('error'),
      'navigation-panel:unfold': () => this.unfold(),
      'navigation-panel:unfold-all': () => this.unfoldAll(),
      'navigation-panel:markers-toggle': () => this.toggleMarkersLocal(),
    }))

    this.disposables.add(atom.config.observe('navigation-panel.general.traceVisible', (value) => {
      this.traceVisible = value
      if (!value) { this.setVisibleItem(this.headers, -1, -1) }
    }))

    this.disposables.add(atom.workspace.observeTextEditors( (editor) => {
      let total = 9 ; const buffer = editor.getBuffer()
      if (!('navigationMarkerLayers' in buffer)) {
        buffer.navigationMarkerLayers = {}
        for (let i=1; i<=total; i++) {
          buffer.navigationMarkerLayers[i] = (
            buffer.addMarkerLayer({ role:`navigation-marker-${i}` })
          )
        }
      }
      for (let i=1; i<=total; i++) {
        for (let decoType of this.markerType.split('&')) {
          editor.decorateMarkerLayer(buffer.navigationMarkerLayers[i], {
            type:decoType, class:`navigation-marker-${i} navigation-marker ${decoType}-decoration`
          })
        }
      }
      this.markersForEditor(editor, this.markLines)
    }))

    this.disposables.add(atom.workspace.observeActivePaneItem( (item) => {
      if (!item) {
        this.grammarUnsubsribe()
        this.editorUnsubscribe()
        this.navigationTree.update(null)
      } else if (this.editor == item) {
        return
      } else if ('pdfjsPath' in item) {
        this.grammarUnsubsribe()
        this.viewerSubscribe(item)
      } else if (atom.workspace.isTextEditor(item)) {
        this.grammarUnsubsribe()
        this.grammarDispose = item.observeGrammar( () => {
          this.editorSubscribe(item)
        })
      }
    }))

    this.updateVisibleItems = throttle(() => {
      if (!this.scanner) { return }
      this.markVisibleItems(this.editorView.getScrollTop())
      this.navigationTree.update( this.headers )
    }, 50)

    this.onDidUpdateCallbacks = new Set()
  },

  deactivate() {
    for (let editor of atom.workspace.getTextEditors()) { this.clearMarkers(editor) }
    this.grammarUnsubsribe()
    this.editorUnsubscribe()
    this.navigationTree.destroy()
    this.disposables.dispose()
  },

  grammarUnsubsribe() {
    if (this.grammarDispose) {
      this.grammarDispose.dispose()
      this.grammarDispose = null
    }
  },

  editorUnsubscribe() {
    if (this.scanner) {
      this.editorDispose .dispose() ; this.editorDispose  = null
      this.cursorsDispose.dispose() ; this.cursorsDispose = null
      if (this.scrollDispose) {
        this.scrollDispose.dispose()
        this.scrollDispose = null
      }
      for (let cursor of this.editor.getCursors()) {
        cursor.navigationDisposeODCP.dispose()
        cursor.navigationDisposeODD .dispose()
        delete cursor.navigationItems
      }
    }
    if (this.outlineDispose) {
      this.outlineDispose.dispose()
      this.currentDispose.dispose()
    }
    this.editor = null ; this.editorView = null ; this.scanner = null ; this.headers = null
  },

  editorSubscribe(editor) {
    this.subscription = this.subscription.then(() => {
      this.editorUnsubscribe()
      this.editor = editor ; this.scanner = null
      if (this.editor) {
        this.editorView = atom.views.getView(editor)
        let scopeName = this.editor.getGrammar().scopeName
        if (scopeName in SCANNERS) {
          this.scanner = new SCANNERS[scopeName](this.editor)
          this.editorDispose = this.editor.onDidStopChanging( () => {
            this.subscription = this.subscription.then(() => { this.update() })
          })
          this.cursorsDispose = this.editor.observeCursors( (cursor) => {
            cursor.navigationItems = []
            if (this.headers) { // may by null
              this.findCursorItems(cursor, cursor.getBufferPosition().row)
              this.navigationTree.update( this.headers )
            }
            cursor.navigationDisposeODCP = cursor.onDidChangePosition( (e) => {
              if (e.oldBufferPosition===e.newBufferPosition || e.textChanged) { return }
              this.clearCursorItems(cursor)
              this.findCursorItems(cursor, e.newBufferPosition.row)
              this.navigationTree.update( this.headers )
            })
            cursor.navigationDisposeODD = cursor.onDidDestroy(() => {
              this.clearCursorItems(cursor)
              cursor.navigationDisposeODCP.dispose()
              cursor.navigationDisposeODD .dispose()
              this.navigationTree.update( this.headers )
            })
          })
          this.scrollDispose = this.editorView.onDidChangeScrollTop(() => {
            if (!this.traceVisible) { return }
            this.updateVisibleItems()
          })
        }
      }
    }).then(() => {
      this.subscription = this.subscription.then(() => { this.update({ instant:true }) })
    })
  },

  viewerSubscribe(viewer) {
    this.editorUnsubscribe()
    this.editor = viewer
    let scanner = new ScannerPDFjs(this.editor)
    this.navigationTree.update([])
    this.outlineDispose = viewer.observeOutline( (outline) => {
      this.headers = scanner.getHeaders(outline)
      this.navigationTree.update( this.headers, { instant:true } )
    })
    let startup = true
    this.currentDispose = viewer.observeCurrent( (destHash) => {
      if (!this.headers) { return }
      let items = this.getFlattenHeaders()
      let level = 0
      for (var i=items.length-1; i>=0; i--) {
        if (items[i].destHash===destHash) {
          items[i].currentCount = 1
          items[i].stackCount   = 1
          level = items[i].level
        } else if (items[i].level<level) {
          items[i].currentCount = 0
          items[i].stackCount   = 1
          level = items[i].level
        } else {
          items[i].currentCount = 0
          items[i].stackCount   = 0
        }
      }
      this.navigationTree.update( this.headers, { isntant:startup })
      startup = false
    })
  },

  open(userOptions) {
    let previouslyFocusedElement = document.activeElement
    let options = { location:atom.config.get('navigation-panel.general.defaultSide'), searchAllPanes:true }
    atom.workspace.open(this.navigationTree, { ...options, ...userOptions }).then( () => { previouslyFocusedElement.focus() })
  },

  hide() {
    let previouslyFocusedElement = document.activeElement
    atom.workspace.hide(this.navigationTree)
    previouslyFocusedElement.focus()
  },

  toggle() {
    let previouslyFocusedElement = document.activeElement
    atom.workspace.toggle(this.navigationTree).then( () => {
      previouslyFocusedElement.focus()
      this.navigationTree.instant = true
      this.navigationTree.scrollToCurrent()
    })
  },

  update(props) {
    return new Promise(() => {
      if (!this.scanner) {
        this.navigationTree.update(null)
      } else {
        try {
          this.headers = this.scanner.getHeaders()
          for (let cursor of this.editor.getCursors()) {
            this.clearCursorItems(cursor)
            this.findCursorItems(cursor, cursor.getBufferPosition().row)
          }
          this.markVisibleItems(this.editorView.getScrollTop())
          this.navigationTree.update( this.headers, props )
          if (this.markLines) {
            this.refreshMarkers()
          } else {
            this.clearMarkers(this.editor)
          }
        } catch (err) {}
      }
      for (let callback of this.onDidUpdateCallbacks) { callback(this.headers) }
    })
  },

  onDidUpdateHeaders(callback) {
    this.onDidUpdateCallbacks.add(callback)
    return new Disposable(() => {
      this.onDidUpdateCallbacks.delete(callback)
    })
  },

  observeHeaders(callback) {
    callback(this.editor, this.headers)
    return this.onDidUpdateHeaders(callback)
  },

  clearCursorItems(cursor) {
    if (cursor.navigationItems.length>0) {
      cursor.navigationItems[0].currentCount -= 1
      for (let item of cursor.navigationItems) {
        item.stackCount -= 1
      }
    }
    cursor.navigationItems = []
  },

  findCursorItems(cursor, cursorRow) {
    if (this.headers===null) { return }
    this.lookupState(cursor.navigationItems, cursorRow, this.headers)
  },

  lookupState(navigationItems, cursorRow, headers) {
    for (var i=headers.length-1; i>=0; i--) {
      var item = headers[i]
      if (item.startPoint.row<=cursorRow) {
        this.lookupState(navigationItems, cursorRow, item.children)
        if (navigationItems.length===0) {
          item.currentCount += 1
        }
        item.stackCount += 1
        navigationItems.push(item)
        break
      }
    }
  },

  markVisibleItems(scrollTop) {
    if (this.traceVisible && this.headers) {
      let editorHeight = this.editorView.getHeight()
      if (!editorHeight) { return }
      let rowTop = this.editorView.screenPositionForPixelPosition({ top:scrollTop, left:0 }).row
      let rowBot = this.editorView.screenPositionForPixelPosition({ top:scrollTop+editorHeight, left:0 }).row
      this.setVisibleItem(this.headers, rowTop, rowBot)
    }
  },

  setVisibleItem(headers, rowTop, rowBot) {
    if (!headers) { return }
    for (let header of headers) {
      let startRow = this.editor.screenPositionForBufferPosition([header.startPoint.row, 0]).row
      let endRow = this.editor.screenPositionForBufferPosition([header.lastRow, 0]).row
      if ((rowTop<=startRow && startRow<=rowBot) || (startRow<=rowTop && rowTop<=endRow)) {
        header.visibility = 1
      } else {
        header.visibility = 0
      }
      this.setVisibleItem(header.children, rowTop, rowBot)
    }
  },

  getFlattenHeaders() {
    let items = []
    this._getFlattenHeaders(items, this.headers)
    return items
  },

  _getFlattenHeaders(items, headers) {
    for (let item of headers) {
      items.push(item)
      this._getFlattenHeaders(items, item.children)
    }
  },

  foldSectionByRows(startRow, endRow) {
    this.editor.setSelectedBufferRange(
      [[startRow, 1e10], [endRow, 1e10]]
    )
    this.editor.foldSelectedLines()
  },

  foldSectionAt(foldRevel) {
    if (!this.headers) { return }
    let curPos = this.editor.getCursorBufferPosition()
    let header1 = null ; let header2 = null
    let headers = this.getFlattenHeaders()
    for (var i=headers.length-1; i>=0; i--) {
      if (headers[i].startPoint.row <= curPos.row && (!foldRevel || (foldRevel && headers[i].revel===foldRevel))) {
        header1 = headers[i]
        for (var j = i+1; j<headers.length; j++) {
          if (headers[j].revel<=header1.revel) {
            header2 = headers[j]
            break
          }
        }
        break
      }
    }
    let startRow, endRow
    if (!header1) {
      return
    } else {
      startRow = header1.startPoint.row
    }
    if (!header2) {
      endRow = this.editor.getLineCount()
    } else {
      endRow = header2.startPoint.row-1
    }
    this.foldSectionByRows(startRow, endRow)
  },

  unfold () {
    if (!this.headers) { return }
    const currentRow = this.editor.getCursorBufferPosition().row
    this.editor.unfoldBufferRow(currentRow)
    this.editor.scrollToCursorPosition()
  },

  toggleSection() {
    if (!this.headers) { return }
    const currentRow = this.editor.getCursorBufferPosition().row
    if (this.editor.isFoldedAtBufferRow(currentRow)){
      this.unfold()
    } else {
      this.foldSectionAt()
    }
  },

  unfoldAll() {
    if (!this.headers) { return }
    let lrow = this.editor.getLastBufferRow()
    for (let row = 0; row < lrow; row++) {
      this.editor.unfoldBufferRow(row)
    }
    this.editor.scrollToCursorPosition()
  },

  foldAsTable(naviClass=null) {
    if (!this.headers) { return }
    this.unfoldAll()
    let curPos  = this.editor.getCursorBufferPosition()
    let lastRow = this.editor.getLastBufferRow()
    let header0 = null
    let headers = this.getFlattenHeaders()
    for (var header of headers) {
      if (!header0 && header.startPoint.row>0) {
        this.editor.setSelectedBufferRange(
          [[0, 0], [header.startPoint.row-1, 1e10]]
        )
        this.editor.foldSelectedLines()
      } else if (header0 && (!naviClass || (header0.classList.includes(naviClass)))) {
        this.foldSectionByRows(header0.startPoint.row, header.startPoint.row-1)
      }
      header0 = header
    }
    this.foldSectionByRows(header.startPoint.row, lastRow)
    this.editor.setCursorBufferPosition(curPos)
  },

  refreshMarkers() {
    this.clearMarkers(this.editor)
    this._refreshMarkers(this.editor, this.headers)
  },

  _refreshMarkers(editor, headers) {
    const buffer = editor.getBuffer()
    for (var item of headers) {
      let deep = this.markerKind ? item.level : item.revel
      if (deep in buffer.navigationMarkerLayers) {
        buffer.navigationMarkerLayers[deep].markRange([item.startPoint, item.endPoint], { exclusive:true, invalidate:'inside' })
        this._refreshMarkers(editor, item.children)
      }
    }
  },

  clearMarkers(editor) {
    const buffer = editor.getBuffer()
    for (const layer of Object.values(buffer.navigationMarkerLayers)) {
      layer.clear()
    }
  },

  markersForEditor(editor, mode) {
    if (!editor) { return }
    this.clearMarkers(editor)
    if (!mode) { return }
    let scopeName = editor.getGrammar().scopeName
    if (!(scopeName in SCANNERS)) { return }
    let scanner = new SCANNERS[scopeName](editor)
    let headers = scanner.getHeaders()
    this._refreshMarkers(editor, headers)
  },

  toggleMarkersLocal() {
    this.markLines = !this.markLines;
    for (const editor of atom.workspace.getTextEditors()) {
      this.markersForEditor(editor, this.markLines)
    }
  },

  serviceProvider() {
    return {
      getFlattenHeaders: () => {
        return this.getFlattenHeaders()
      },
      onDidUpdateHeaders: (callback) => {
        return this.onDidUpdateHeaders(callback)
      },
      observeHeaders: (callback) => {
        return this.observeHeaders(callback)
      },
    }
  },
}


function throttle(func, timeout) {
  let timer = false
  return (...args) => {
    if (timer) { return }
    timer = setTimeout(() => {
      func.apply(this, args)
      timer = false
    }, timeout)
  }
}
