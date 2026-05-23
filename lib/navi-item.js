/** @babel */
/** @jsx etch.dom */

const etch = require("etch");

class NavigationItem {
  constructor(props) {
    this.updateProps(props);
    if (this.states.visibility === 2 || this.states.collapseWork === 2) {
      this.showChildren = this.computeAutoCollapseShow();
    } else {
      this.showChildren = Boolean(this.states.visibility);
    }
    etch.initialize(this);
    this.attachToElement();
  }

  update(props) {
    this.updateProps(props);
    if (this.states.visibility === 2 || this.states.collapseWork === 2) {
      this.showChildren = this.computeAutoCollapseShow();
    } else if (this.states.collapseWork !== null) {
      this.showChildren = Boolean(this.states.visibility);
    }
    return etch.update(this);
  }

  computeAutoCollapseShow() {
    if (this.item.stackCount > 0) {
      return true;
    }
    if (this.item.traceByVisibility) {
      return this.item.visibility > 0 || this.checkChildrenVisibility(this.item);
    }
    return false;
  }

  updateProps(props) {
    this.item = props;
    this.states = props.states;
    this.skipNextScroll = props.skipNextScroll;
  }

  destroy() {
    etch.destroy(this);
  }

  render() {
    if (this.item.classList.includes("info")) {
      if (!this.states.info) {
        return <div />;
      }
    } else if (this.item.classList.includes("success")) {
      if (!this.states.success) {
        return <div />;
      }
    } else if (this.item.classList.includes("warning")) {
      if (!this.states.warning) {
        return <div />;
      }
    } else if (this.item.classList.includes("error")) {
      if (!this.states.error) {
        return <div />;
      }
    } else if (!this.states.standard) {
      return <div />;
    }

    let iconClass;
    if (this.item.children.length) {
      if (this.showChildren) {
        iconClass = " icon-chevron-down";
      } else {
        iconClass = " icon-chevron-right";
      }
    } else {
      iconClass = " icon-one-dot";
    }

    let naviList;
    if (this.item.children.length && this.showChildren) {
      naviList = this.item.children.map((item) => {
        return (
          <NavigationItem
            {...item}
            key={item.startPoint.row}
            skipNextScroll={this.skipNextScroll}
            states={this.states}
          />
        );
      });
    } else {
      naviList = "";
    }

    let stackClass = this.item.stackCount > 0 ? " stack" : "";
    let currentClass = this.item.currentCount > 0 ? " current" : "";
    let visibleClass = this.item.visibility > 0 ? " visible" : "";

    if (!this.item.visibility && this.item.children.length) {
      if (!this.showChildren && this.checkChildrenVisibility(this.item)) {
        visibleClass = " visible";
      }
    }

    let naviClass = this.item.classList.length ? " " + this.item.classList.join(" ") : "";

    return (
      <div class={"navigation-tree" + stackClass} ref="tree">
        <div class={"navigation-block" + naviClass + currentClass + visibleClass}>
          <div
            class={"navigation-icon navigation-state-icon" + iconClass}
            on={{ click: this.toggleNested }}
          />
          {this.item.display ? this.item.display : ""}
          {this.item.filterResult && this.item.badge != null ? (
            <span class="badge badge-flexible">{this.item.badge}</span>
          ) : this.item.filterRow !== null && this.item.filterRow !== undefined ? (
            <span class="badge badge-flexible">{this.item.filterRow + 1}</span>
          ) : (
            ""
          )}
          <div class="navigation-text" on={{ click: this.scrollToLine }}>
            {this.item.filterResult ? this.item.filterResult : this.item.text}
          </div>
        </div>
        {naviList}
      </div>
    );
  }

  checkChildrenVisibility(item) {
    return (
      item.visibility ||
      !!item.children.filter((child) => this.checkChildrenVisibility(child)).length
    );
  }

  scrollToLine(e) {
    if (e.altKey) {
      atom.clipboard.write(this.item.text);
      atom.notifications.addSuccess("Copied to clipboard!");
      return;
    }
    if (!this.item.navigate) return;
    if (e.ctrlKey) {
      this.item.navigate({ addCursor: true });
    } else {
      this.skipNextScroll?.();
      this.item.navigate();
    }
  }

  toggleNested() {
    this.setCollapsed(this.showChildren);
  }

  setCollapsed(collapsed, options = {}) {
    if (!this.item.children.length) {
      return false;
    }
    if (this.showChildren === !collapsed) {
      return Boolean(options.allowAlreadyCollapsed);
    }
    this.showChildren = !collapsed;
    etch.update(this);
    return true;
  }

  writeAfterUpdate() {
    this.attachToElement();
  }

  attachToElement() {
    if (this.refs.tree) {
      this.refs.tree.navigationTreeView = this;
    }
  }
}

module.exports = { NavigationItem };
