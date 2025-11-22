/** @babel */
/** @jsx etch.dom */

const etch = require('etch')
const { CompositeDisposable, TextEditor } = require('atom')
const Diacritics = require('diacritic')


const STATES = {
  searchBar: null,
  categoryBar: null,
  visibility: null,
  collapseWork: null,
  info: null,
  success: null,
  warning: null,
  error: null,
  standard: null,
  textWrap: null,
  centerScroll: null,
}

// it's required to ommit double scroll request
// 1. from page scroll observer
// 2. from cursor observer
let SCROLL_SKIP = 0

class NavigationTree {

  constructor() {
    this.headers = null
    this.searches = null
    this.instant = false
    this.scrollAnimationID = null
    this.pendingScroll = 0

    STATES.searchBar = atom.config.get('navigation-panel.general.searchBar')
    STATES.categoryBar = atom.config.get('navigation-panel.general.categoryBar')
    STATES.visibility = atom.config.get('navigation-panel.general.visibility')
    STATES.textWrap = atom.config.get('navigation-panel.general.textWrap')
    STATES.info = atom.config.get('navigation-panel.categories.info')
    STATES.success = atom.config.get('navigation-panel.categories.success')
    STATES.warning = atom.config.get('navigation-panel.categories.warning')
    STATES.error = atom.config.get('navigation-panel.categories.error')
    STATES.standard = atom.config.get('navigation-panel.categories.standard')

    this.disposables = new CompositeDisposable(
      atom.config.observe('navigation-panel.general.centerScroll', {}, (value) => {
        STATES.centerScroll = value
      }),
      atom.commands.add('atom-workspace', {
        'navigation-panel:all-categories': () => {
          this.categoriesChange(['info', 'success', 'warning', 'error', 'standard'], true)
        },
        'navigation-panel:none-categories': () => {
          this.categoriesChange(['info', 'success', 'warning', 'error', 'standard'], false)
        },
        'navigation-panel:categories-toggle': () => {
          this.categoriesChange(['info', 'success', 'warning', 'error', 'standard'])
        },
        'navigation-panel:info-toggle': () => {
          this.categoriesChange(['info'])
        },
        'navigation-panel:success-toggle': () => {
          this.categoriesChange(['success'])
        },
        'navigation-panel:warning-toggle': () => {
          this.categoriesChange(['warning'])
        },
        'navigation-panel:error-toggle': () => {
          this.categoriesChange(['error'])
        },
        'navigation-panel:standard-toggle': () => {
          this.categoriesChange(['standard'])
        },
        'navigation-panel:collapse-mode': () => {
          STATES.visibility = STATES.collapseWork = 0
          etch.update(this)
        },
        'navigation-panel:expand-mode': () => {
          STATES.visibility = STATES.collapseWork = 1
          etch.update(this)
        },
        'navigation-panel:auto-collapse': () => {
          STATES.visibility = 2
          etch.update(this)
        },
        'navigation-panel:focus-current': () => {
          STATES.collapseWork = 2
          etch.update(this)
        },
        'navigation-panel:text-wrap-toggle': () => {
          STATES.textWrap = !STATES.textWrap
          etch.update(this)
        },
        'navigation-panel:search-bar-toggle': () => {
          STATES.searchBar = !STATES.searchBar
          etch.update(this)
        },
        'navigation-panel:category-bar-toggle': () => {
          STATES.categoryBar = !STATES.categoryBar
          etch.update(this)
        },
        'navigation-panel:search': () => {
          this.focusSearch()
        },
        'navigation-panel:clear': () => {
          this.clearQuery()
        },
      }),
    )
    etch.initialize(this)
    this.disposables.add(this.refs.searchEditor.onDidChange(() => {
      this.update(this.headers, { instant: true })
    }))
  }

  destroy() {
    this.disposables.dispose()
    etch.destroy(this)
  }

  render() {
    let searchBar, naviList, categoryBar
    searchBar = <div class='navigation-search' style={{
      display: STATES.searchBar ? 'block' : 'none'
    }}>{
        etch.dom(TextEditor, { ref: 'searchEditor', mini: true, placeholderText: 'Search...' })
      }<div class="icon-remove-close" on={{ click: this.clearQuery }} /></div>
    let items = this.searches === null ? this.headers : this.searches
    if (!items) {
      naviList = <div class="navigation-list">
        <background-tips>
          <ul class='centered background-message'>
            <li>This grammar is not supported</li>
          </ul>
        </background-tips>
      </div>
    } else if (items.length) {
      let wspace = STATES.textWrap || !items ? 'unset' : 'max-content'
      naviList = <div class="navigation-list" style={{ width: wspace }}>{
        items.map((item) => {
          return <TreeView {...item} key={item.startPoint ? item.startPoint.row : item.text} />
        })
      }</div>
    } else {
      naviList = <div class="navigation-list">
        <background-tips>
          <ul class='centered background-message'>
            <li>No results</li>
          </ul>
        </background-tips>
      </div>
    }
    if (STATES.categoryBar) {
      categoryBar = <div class="navigation-desk">
        <input type='checkbox'
          class='navigation-switch input-toggle navigation-switch-info'
          checked={STATES.info} onChange={() => this.categoriesChange(['info'])}
        />
        <input type='checkbox'
          class='navigation-switch input-toggle navigation-switch-success'
          checked={STATES.success} onChange={() => this.categoriesChange(['success'])}
        />
        <input type='checkbox'
          class='navigation-switch input-toggle navigation-switch-warning'
          checked={STATES.warning} onChange={() => this.categoriesChange(['warning'])}
        />
        <input type='checkbox'
          class='navigation-switch input-toggle navigation-switch-error'
          checked={STATES.error} onChange={() => this.categoriesChange(['error'])}
        />
        <input type='checkbox'
          class='navigation-switch input-toggle navigation-switch-standard'
          checked={STATES.standard} onChange={() => this.categoriesChange(['standard'])}
        />
      </div>
    } else {
      categoryBar = <div class="navigation-desk" />
    }
    return <atom-panel class="navigation-panel">{searchBar}<div class="navigation-scroller">{naviList}</div>{categoryBar}</atom-panel>
  }

  categoriesChange(classNames, value = null) {
    for (let className of classNames) {
      if (value === null) {
        STATES[className] = !STATES[className]
      } else {
        STATES[className] = value
      }
    }
    etch.update(this)
  }

  update(headers, props) {
    this.headers = headers
    this.filter() // .searches
    if (props) {
      if (props.hasOwnProperty('instant') && props.instant) {
        this.instant = true
      }
    }
    etch.update(this)
  }

  readAfterUpdate() {
    STATES.collapseWork = null
    this.scrollToCurrent()
  }

  scrollToCurrent() {
    if (SCROLL_SKIP) {
      SCROLL_SKIP -= 1
      return
    }
    let element
    element = document.getElementsByClassName('navigation-block visible')[0]
    if (element) { return this.scrollToElement(element) }
    element = document.getElementsByClassName('navigation-block current')[0]
    if (element) { return this.scrollToElement(element) }
  }

  scrollToElement(element) {
    // If instant mode, use direct scroll without animation
    if (this.instant) {
      this.instant = false
      let container = document.querySelector('.navigation-scroller')
      if (!container) { return }
      let elementTop = element.offsetTop
      let elementHeight = element.offsetHeight
      let containerHeight = container.clientHeight
      container.scrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2)
      return
    }

    // Custom smooth scroll animation
    let container = document.querySelector('.navigation-scroller')
    if (!container) { return }

    let elementTop = element.offsetTop
    let elementHeight = element.offsetHeight
    let containerHeight = container.clientHeight
    let targetScrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2)

    this.pendingScroll = targetScrollTop - container.scrollTop

    if (this.scrollAnimationID) {
      cancelAnimationFrame(this.scrollAnimationID)
      this.scrollAnimationID = null
    }

    const animate = () => {
      if (Math.abs(this.pendingScroll) < 1) {
        container.scrollTop = targetScrollTop
        this.pendingScroll = 0
        this.scrollAnimationID = null
        return
      }
      let step = Math.trunc(this.pendingScroll / 12)
      if (step === 0) step = Math.sign(this.pendingScroll)
      let currentTop = container.scrollTop
      container.scrollTop += step
      this.pendingScroll -= step
      if (container.scrollTop===currentTop) {
        return // stop if not scrolling more
      }
      this.scrollAnimationID = requestAnimationFrame(animate)
    }

    this.scrollAnimationID = requestAnimationFrame(animate)
    this.instant = false
  }

  getTitle() {
    return 'Navigation'
  }

  getDefaultLocation() {
    return atom.config.get('navigation-panel.general.defaultSide')
  }

  getAllowedLocations() {
    return ['left', 'right']
  }

  filter() {
    if (!this.headers) { this.searches = null; return }
    let query = this.refs.searchEditor.getText()
    if (query.length === 0) { this.searches = null; return }
    query = Diacritics.clean(query)
    let scoredItems = []
    this._filter(query, scoredItems, this.headers)
    this.searches = scoredItems.sort((a, b) => b.score - a.score)
  }

  _filter(query, items, headers) {
    for (var item of headers) {
      item.score = atom.ui.fuzzyMatcher.score(Diacritics.clean(item.text), query)
      if (item.score > 0) {
        let matches = query.length > 0 ? atom.ui.fuzzyMatcher.match(
          Diacritics.clean(item.text), query, { recordMatchIndexes: true }
        ).matchIndexes : []
        let display = this.highlightMatchesInElement(
          item.text, matches, item.startPoint ? item.startPoint.row : null
        )
        items.push({ ...item, children: [], display: display })
      }
      this._filter(query, items, item.children)
    }
  }

  focusSearch() {
    this.refs.searchEditor.element.focus()
  }

  clearQuery() {
    this.refs.searchEditor.setText('')
  }

  highlightMatchesInElement(text, matches, row) {
    let el = row !== null ? [<span class='badge badge-flexible'>{row + 1}</span>] : []
    let matchedChars = []
    let lastIndex = 0
    for (const matchIndex of matches) {
      const unmatched = text.substring(lastIndex, matchIndex)
      if (unmatched) {
        if (matchedChars.length > 0) {
          el.push(<span class='character-match'>{matchedChars.join('')}</span>)
          matchedChars = []
        }
        el.push(<span>{unmatched}</span>)
      }
      matchedChars.push(text[matchIndex])
      lastIndex = matchIndex + 1
    }
    if (matchedChars.length > 0) {
      el.push(<span class="character-match">{matchedChars.join('')}</span>)
    }
    const unmatched = text.substring(lastIndex)
    if (unmatched) {
      el.push(<span>{unmatched}</span>)
    }
    return el
  }
}


class TreeView {

  constructor(item) {
    this.item = item
    if (STATES.visibility === 2 || STATES.collapseWork === 2) {
      if (this.item.stackCount > 0) {
        this.showChildren = true
      } else {
        this.showChildren = false
      }
    } else {
      this.showChildren = Boolean(STATES.visibility)
    }
    etch.initialize(this)
  }

  update(item) {
    this.item = item
    if (STATES.visibility === 2 || STATES.collapseWork === 2) {
      if (this.item.stackCount > 0) {
        this.showChildren = true
      } else {
        this.showChildren = false
      }
    } else if (STATES.collapseWork !== null) {
      this.showChildren = Boolean(STATES.visibility)
    }
    return etch.update(this)
  }

  destroy() {
    etch.destroy(this)
  }

  render() {
    if (this.item.classList.includes('info')) {
      if (!STATES.info) { return <div /> }
    } else if (this.item.classList.includes('success')) {
      if (!STATES.success) { return <div /> }
    } else if (this.item.classList.includes('warning')) {
      if (!STATES.warning) { return <div /> }
    } else if (this.item.classList.includes('error')) {
      if (!STATES.error) { return <div /> }
    } else if (!STATES.standard) { return <div /> }

    let iconClass
    if (this.item.children.length) {
      if (this.showChildren) {
        iconClass = ' icon-chevron-down'
      } else {
        iconClass = ' icon-chevron-right'
      }
    } else {
      iconClass = ' icon-one-dot'
    }

    let naviList
    if (this.item.children.length && this.showChildren) {
      naviList = this.item.children.map((item) => {
        return <TreeView {...item} key={item.startPoint ? item.startPoint.row : item.text} />
      })
    } else {
      naviList = ''
    }

    let stackClass = this.item.stackCount > 0 ? ' stack' : ''
    let currentClass = this.item.currentCount > 0 ? ' current' : ''
    let visibleClass = this.item.visibility > 0 ? ' visible' : ''

    if (!this.item.visibility && this.item.children.length) {
      if (!this.showChildren && this.checkChildrenVisibility(this.item)) {
        visibleClass = ' visible'
      }
    }

    let naviClass = this.item.classList.length ? ' ' + this.item.classList.join(' ') : ''

    return <div class={"navigation-tree" + stackClass}>
      <div class={"navigation-block" + naviClass + currentClass + visibleClass}>
        <div class={"navigation-icon icon" + iconClass} on={{ click: this.toggleNested }} />
        {this.item.display ? this.item.display : ""}
        <div class="navigation-text" on={{ click: this.scrollToLine }}>{this.item.text}</div>
      </div>
      {naviList}
    </div>
  }

  checkChildrenVisibility(item) {
    return item.visibility || !!item.children.filter(
      child => this.checkChildrenVisibility(child)
    ).length
  }

  scrollToLine(e) {
    if (this.item.viewer) {
      this.item.viewer.scrollToDestination(this.item)
      atom.views.getView(this.item.viewer).focus()
      return
    } else if (e.ctrlKey) {
      this.item.editor.addCursorAtBufferPosition(
        [this.item.startPoint.row, 0]
      )
    } else if (e.altKey) {
      atom.clipboard.write(this.item.text)
      atom.notifications.addSuccess('Header text has been copied!')
    } else {
      SCROLL_SKIP += 1
      this.item.editor.setCursorBufferPosition(
        [this.item.startPoint.row, 0], { autoscroll: false }
      )
      this.item.editor.scrollToCursorPosition(
        { center: STATES.centerScroll }
      )
    }
    atom.views.getView(this.item.editor).focus()
  }

  toggleNested() {
    this.showChildren = !this.showChildren
    etch.update(this)
  }
}

module.exports = { NavigationTree }
