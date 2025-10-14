import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { Button, ButtonGroup } from "@blueprintjs/core";
import "./style.less";
import { extension_helper } from "./helper";
import Main from "./TagList";
const starredPagesWrapper = document.querySelector(".starred-pages-wrapper");

export function Extension() {
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(true);
  return (
    <div className="roam-tags-extension">
      <ButtonGroup fill>
        <Button
          intent={isShortcutsOpen ? "primary" : "none"}
          onClick={() => {
            setIsShortcutsOpen(!isShortcutsOpen);
            starredPagesWrapper.classList.toggle("roam-tags-show-shortcuts");
            document
              .querySelector(".roam-tags-tag-list")
              .classList.toggle("show");
          }}
        >
          Shortcuts
        </Button>
        <Button
          intent={!isShortcutsOpen ? "primary" : "none"}
          onClick={() => {
            setIsShortcutsOpen(!isShortcutsOpen);
            starredPagesWrapper.classList.toggle("roam-tags-show-shortcuts");
            document
              .querySelector(".roam-tags-tag-list")
              .classList.toggle("show");
          }}
        >
          Tags
        </Button>
      </ButtonGroup>
    </div>
  );
}

function TagEl() {
  return (
    <>
      <div
        className="flex-v-box starred-pages-wrapper"
        style={{ flex: "1 1 0px", padding: "8px 0px", height: "100%" }}
      >
        <div
          style={{ flex: "0 0 1px", backgroundColor: "rgb(57, 75, 89)" }}
        ></div>
        <Main />
      </div>
    </>
  );
}

export function initExtension() {
  // 插入位置 rm-left-sidebar__roam-depot
  const div = document.createElement("div");
  starredPagesWrapper.parentElement.insertBefore(div, starredPagesWrapper);
  const divRoot = ReactDOM.createRoot(div)
  divRoot.render((<Extension />) as any);
  // 插入要 Tag list
  const tagListDiv = document.createElement("div");
  tagListDiv.classList.add("roam-tags-tag-list");
  starredPagesWrapper.parentElement.insertBefore(
    tagListDiv,
    starredPagesWrapper
  );
  const tagRoot = ReactDOM.createRoot(tagListDiv);
  tagRoot.render((<TagEl />) as any);
  // 卸载时需要移除 DOM 元素
  extension_helper.on_uninstall(() => {
    // ReactDOM.createRoot(div).unmount();
    divRoot.unmount();
    tagRoot.unmount();
    div.remove();
    tagListDiv.remove();
  });
}
