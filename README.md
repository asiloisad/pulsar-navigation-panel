# navigation-panel

Document navigation panel using special symbols.

![docface](https://github.com/asiloisad/pulsar-navigation-panel/blob/master/assets/docface.png?raw=true)

## Installation

To install `navigation-panel` search for [navigation-panel](https://web.pulsar-edit.dev/packages/navigation-panel) in the Install pane of the Pulsar settings or run `ppm install navigation-panel`. Alternatively, you can run `ppm install asiloisad/pulsar-navigation-panel` to install a package directly from the GitHub repository.

## Sections panel

This package provides a panel for navigating through custom symbols in text editors. The tree items are manually created by inserting special markers into the text editor. Multiple scopes are supported (see below) with their own marker system. You can open or hide the panel using the `navigation-panel:open` and `navigation-panel:hide` commands or optionally use `navigation-panel:toggle`. The package supports multiple cursors.

## Real section level

The package introduces the concept of multi-level headers. The user enters a tag with a level, which indicates **the maximum level** of the text associated with that tag. The actual level of the header will be determined when building the header tree using the rule that a header can have a level at most one greater than its predecessor. For example, if you enter a level 1 heading, then a level 2 heading, and then a level 5 heading, the actual level of the last heading will be 3. The marker designations are for real headers. The real section level is used everywhere instead of the user level.

## Highlight section

For each header, the package can create a marker to highlight the corresponding line of text in the editor. The marker style can be customized.

## Panel interactions

A panel has few handly commands. There are mouse interactions:

- `LeftMouseButton`: scroll to header
- `Ctrl-LeftMouseButton`: create a new cursor on the header line and scroll to
- `Alt-LeftMouseButton`: copy header text

At context menu there are shortcuts to modify settings locally.

## Search bar

Headers can be filtered. Fuzzy-finder is used and items are sorted by score.

- `navigation-panel:search`: focus search-editor
- `navigation-panel:clear`: clear text of search-editor

## Categories

Headers can be marked with categories. The categories can be filtered in the bottom bar of the panel, the context menu of the panel, or using commands. The categories are predefined: info, success, warning, error. The meaning of the categories depends on the creativity of the user, so you can use them as you like.

The category settings can be changed globally in the package settings or locally using commands or in the panel:

- `navigation-panel:all-categories`: activate all categories
- `navigation-panel:none-categories`: deactivate all categories
- `navigation-panel:categories-toggle`: toggle all categories
- `navigation-panel:info-toggle`: toggle info category headers
- `navigation-panel:success-toggle`: toggle success category headers
- `navigation-panel:warning-toggle`: toggle warning category headers
- `navigation-panel:error-toggle`:  toggle error category headers
- `navigation-panel:standard-toggle`:  toggle category-less headers

## Collapse modes

The elements of the header tree can be collapsed, which can improve workflow or document clarity. The global settings can be changed in the package settings, and local settings can be adjusted using the context menu of the panel or through commands:

- `navigation-panel:collapse-mode`: collapse all headers now and if rebuilding
- `navigation-panel:expand-mode`: uncollapse all headers now and if rebuilding
- `navigation-panel:auto-collapse`: expand only active headers

## Section folding

There are functions that provide folding actions (fold, unfold, or toggle) for sections. A special feature is the ability to collapse all sections to view them as a table of contents. You may be interested in the following commands:

- `navigation-panel:fold-toggle`: toggle fold of current section
- `navigation-panel:fold-section`: fold current section
- `navigation-panel:fold-section-at-n`: fold last section at level *n*
- `navigation-panel:fold-as-table`: fold all section but in nested form
- `navigation-panel:fold-all-infos`: fold as table, but only headers with category `info`
- `navigation-panel:fold-all-successes`: fold as table, but only headers with category `success`
- `navigation-panel:fold-all-warnings`: fold as table, but only headers with category `warning`
- `navigation-panel:fold-all-errors`: fold as table, but only headers with category `error`
- `navigation-panel:unfold`: unfold current section
- `navigation-panel:unfold-all`: unfold all sections

## regex testing

In order to search for markers in a text editor, all lines of the editor are tested using global regular expressions. If the global expression returns a positive search result, the matched lines are further processed. Global expressions can be found below, with different expressions for each scope.

You can test and analyze the regex patterns below on [regex101](https://regex101.com/). Just select the flavor as `ECMAScript (JavaScript)` and paste the statement.

## Customize the appearance

Markers can be customized to meet the user's needs. The customization file `styles.less` can be opened by menu bar `File/Stylesheet...` or by command `application:open-your-stylesheet`.

- e.g. all markers has highlighted background, but only level 1, 2 and 3 has their own color:
  ```less
  .navigation-marker {
    background: rgba(233, 228, 141, 0.3);
  }
  .navigation-marker-3 {
    background: rgba(200, 197, 243, 0.3);
  }
  .navigation-marker-2 {
    background: rgba(250, 192, 209, 0.3);
  }
  .navigation-marker-1 {
    background: rgba(197, 218, 131, 0.3);
  }
  ```

- e.g. add top border to markers with level 1:
  ```less
  .navigation-marker-1 {
    border-top: 0.016px solid @text-color-info;
  }
  ```

- e.g. change font to monospace (or any other...):
  ```less
  .navigation-panel {
    font-family: monospace;
  }
  ```

- e.g. change style of visible headers:
  ```less
  .navigation-panel .visible {
    background: fade(green, 5%);
  }
  ```

# Supported scopes

## ASCII

Global regular expression is `^(=={0,5}|#\#{0,5})[ \t]+(.+?)(?:[ \t]+\1)?$`.

## LaTeX

Global regular expression is `([^%\n]*)%(\$+)([\*\+\-\!\_]?)%(.*)|^[^\%\n]*\\(part*?|chapter*?|section*?|subsection*?|subsubsection*?|paragraph*?|subparagraph*?)\*?(?:\[(.*)\])?{(.*)}`. The `\part{...}` is equal level 4, `\chapter{...}` is level 5 etc. The section commands can be changed in package settings.

- e.g. `%$!% Countries` -> `1. Countries` with error category
- e.g. `%$$% United Kingdom` -> `1.1. United Kingdom`
- e.g. `\part{Resources}` -> `1.1.1.1. Resources`
- e.g. `\part[Resources]{Resources but to long to TOC}` -> `1.1.1.1. Resources`

In case of `([^%\n]*)%(\$+)%(.*)`, the additional letter can be used to provide additional visual effect:

- `*`: info category
- `+`: success category
- `-`: warning category
- `!`: error category
- `_`: separator category

## BibTeX

Global regular expression is `([^%\n]*)%(\$+)([\*!-]?)%(.*)|^[ ]*\@(\w*)[ ]*{[ ]*([^\,]*)`. The `@<type>{<text>,` is level 6.

- e.g. `%$% Bibliography about countries` -> `1. Bibliography about countries`
- e.g. `%$$% United Kingdom` -> `1.1. United Kingdom`
- e.g. `@book{jk2021, ...` -> `1.1.1.1.1.1. jk2021`

Additional letter can be used to provide additional visual effect:

- `*`: info category
- `+`: success category
- `-`: warning category
- `!`: error category
- `_`: separator category

## Markdown

Global regular expression is `^ *(\#+) (.*)`. The level is defined as count of `#`. The number of levels is endless.

- e.g. `# Countries` -> `1. Countries`
- e.g. `## United Kingdom` -> `1.1. United Kingdom`

## Tasklist

Global regular expression is `(?:^(#+) +(.+?) *$|^ *(.+?) *: *$)`. The level is defined as count of `#`. The number of levels is endless. A header level is equal 5.

- e.g. `# Countries` -> `1. Countries`
- e.g. `## United Kingdom` -> `1.1. United Kingdom`
- e.g. `United Kingdom:` -> `1.1.1.1.1. United Kingdom`

## Python

Global regular expression is `^([^#\n]*)#(?:%%)?(\$+[spv1]?|\?)([\*\+\-\!\_]?)#(.*)` where count of `$` mean the level on list. Headers are compatible with [hydrogen-next](https://github.com/asiloisad/pulsar-hydrogen-next) cells.

Additional letter can be used to provide additional parse effect:

- `s`: get only text from first string which occur at line
- `p`: python def or class; show only type and name of object
- `v`: variable; show only name of variable
- `1`: use only first word (split by whitespace), without optional after-colon

One additional letter can be used to assign a category:

- `*`: info category
- `+`: success category
- `-`: warning category
- `!`: error category

Any additional letters can be used to provide additional visual effect:

- `_`: separator line above the item
- `<`: increase font size
- `;`: font weight is bold

As special case you can use `#?#` or `#?<category>#` which mean auto level base on pattern `<any>(<lvl as int>, "<text>"<any>)`. It is useful e.g. in PyLaTex or similar.

- e.g. `#$# Countries` -> `1. Countries`
- e.g. `#$$$# Countries` -> `1. Countries` and cell marker
- e.g. `#$$# United Kingdom` -> `1.1. United Kingdom`
- e.g. `a = 5 #$$v#` -> `1.1. a`
- e.g. `class MyCounty(Country): #$$p#` -> `1.1. MyCounty`
- e.g. `document.section(1, 'Countries') #?!#` -> `1. Countries`
- e.g. `document.section(2, 'United Kingdom') #?+#` -> `1.1. United Kingdom` with success category
- e.g. `document.section(2, 'United Kingdom') #?!#` -> `1.1. United Kingdom` with error category

## C-like

Global regular expression is `^([^\/\/\n]*)\/\/(\$+[sv1]?|\?)([\*\+\-\!\_]?)\/\/(.*)` where count of `$` mean the level on list.

Additional letter can be used to provide additional parse effect:

- `s`: get only text from first string which occur at line
- `v`: variable; show only name of variable
- `1`: use only first word (split by whitespace)

Additional letter can be used to provide additional visual effect:

- `*`: info category
- `+`: success category
- `-`: warning category
- `!`: error category
- `_`: separator category

As special case you can use `//?//` or `//?<category>//` which mean auto level base on pattern `<any>(<lvl as int>, "<text>"<any>)`.

- e.g. `//$// Countries` -> `1. Countries`
- e.g. `//$$// United Kingdom` -> `1.1. United Kingdom`
- e.g. `a = 5 //$$v//` -> `1.1. a`
- e.g. `document.section(1, 'Countries') //?!//` -> `1. Countries`
- e.g. `document.section(2, 'United Kingdom') //?+//` -> `1.1. United Kingdom` with success category
- e.g. `document.section(2, 'United Kingdom') //?!//` -> `1.1. United Kingdom` with error category

## JavaScript

Global regular expression is `^([^\/\/\n]*)\/\/(?:%%)?(\$+[scfv1]?|\?)([\*\+\-\!\_]?)\/\/(.*)` where count of `$` mean the level on list.

Additional letter can be used to provide additional parse effect:

- `s`: get only text from first string which occur at line
- `c`: class, interface or enum; show only type and name of object
- `f`: function; show function, const, let, var, or async declarations
- `v`: variable; show only name of variable (const/let/var)
- `1`: use only first word (split by whitespace), without optional after-brace

One additional letter can be used to assign a category:

- `*`: info category
- `+`: success category
- `-`: warning category
- `!`: error category

Any additional letters can be used to provide additional visual effect:

- `_`: separator line above the item
- `<`: increase font size
- `;`: font weight is bold

As special case you can use `//?//` or `//?<category>//` which mean auto level base on pattern `<any>(<lvl as int>, "<text>"<any>)`.

- e.g. `//$// Main Section` -> `1. Main Section`
- e.g. `//$$// Sub Section` -> `1.1. Sub Section`
- e.g. `class MyClass { //$c// Class definition` -> `1. MyClass`
- e.g. `function myFunc() { //$f// Function` -> `1. myFunc`
- e.g. `const value = 10; //$$v//` -> `1.1. value`
- e.g. `document.section(1, 'Main') //?!//` -> `1. Main` with error category
- e.g. `document.section(2, 'Sub') //?+//` -> `1.1. Sub` with success category

## ReStructuredText

Global regular expression is `^(.+)\n([!-/:-@[-[-~])\2+$`.

## SOFiSTiK

Global regular expression is `^ *(#define [^\n=]+$|#enddef)|^!([+-\\#\\$])!(?:chapter|kapitel) (.*)|(^(?! *\$)[^!\n]*)!(\$+)!(.*)|^ *([+-])?prog +([^\n]*)(?:\n *head +(.+))?|^ *!.! +(.*)|^\$ graphics +(\d+) +\| +picture +(\d+) +\| +layer +(\d+) +: *(.*)`. The `chapter` is equal level 4, `prog` is equal level 5 and `label` is equal level 6.

- e.g. `!$! Design slab` -> `1. Design slab`
- e.g. `!$$! Req. reinforcement` -> `1.1. Req. reinforcement`
- e.g. `!+!Chapter Design` -> `1.1.1.1. Design`
- e.g. `+prog aqua` -> `1.1.1.1.1. aqua`
- e.g. `+prog aqua \n head sections` -> `1.1.1.1.1.1. aqua: head sections`

## Sinumerik

Global regular expression is `^;{2}[*+\-!]? (.+)$`.

- e.g. `;;* TODO`

Additional letter can be used to provide additional visual effect:

- `*`: info category
- `+`: success category
- `-`: warning category
- `!`: error category

## pdf-viewer

The package support the outline tree of [pdf-viewer](https://github.com/asiloisad/pulsar-pdf-viewer). You can search through document by all-in outline tree instead of PDFjs outline. A section number can be hidden.

# Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub — any feedback's welcome!
