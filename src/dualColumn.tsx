import { useState } from "react";
import ReactDom from "react-dom/client";
import { extension_helper } from "./helper";
import { Button } from "@blueprintjs/core";
import {
  useCurrentTagState,
  useDualColumnState,
  useModeState,
} from "./useModeState";
import { TagedPages } from "./TagedPages";

const roamMainEl = document.querySelector(".roam-main");
const el = document.createElement("div");
el.classList.add("dual-column-container");
const root = ReactDom.createRoot(el);

function Comp() {
  const [mode, setMode] = useModeState();
  const [isOpen, setIsOpen] = useDualColumnState();

  return (
    <div
      style={{
        height: "100%",
      }}
    >
      <TagedPages
        onBack={() => {
          setMode("tree");
          setIsOpen(false);
        }}
      />
    </div>
  );
}

export function initEl() {
  roamMainEl.parentElement.insertBefore(el, roamMainEl);
  extension_helper.on_uninstall(() => {
    close();
  });
  // @ts-ignore
  root.render(<Comp />);
}

export function close() {
  root.unmount();
  roamMainEl.parentElement.removeChild(el);
}
