import React, { useEffect, useState } from "react";
import {
  Button,
  ButtonGroup,
  Icon,
  Menu,
  MenuItem,
  Popover,
  Tooltip,
  Tree,
  MenuDivider,
} from "@blueprintjs/core";
import { TagedPages } from "./TagedPages";
import { close, initEl } from "./dualColumn";
import { useModeState, useCurrentTagState, useDualColumnState } from "./useModeState";

const PAGE_SIZE = 20;

// 把 "A/B/C" 变成 ["A","B","C"]
const splitTags = (title = "") =>
  title
    .split("/")
    // .map((s) => s.trim()) // 不trim 是因为 tag 里可能有空格
    .filter(Boolean);

// 把一条 tagChain 写进树，并沿途累加 count
const putChain = (root, tagChain, page) => {
  let cur = root;
  tagChain.forEach((tag) => {
    if (!cur[tag]) cur[tag] = { pages: [], count: 0, children: {} };
    cur[tag].count += page.refs.length; // 每经过一次就 +1
    cur = cur[tag].children;
  });
  // 叶子节点挂 page
  const leafContainer = tagChain
    .slice(0, Math.max(0, tagChain.length))
    .reduce((o, t, index, arr) => {
      if (index === arr.length - 1) {
        return o[t];
      }
      return o[t].children;
    }, root);

  if (
    leafContainer.pages &&
    !leafContainer.pages?.find((p) => p.uid === page.uid)
  ) {
    leafContainer.pages.push(page);
  }
};

async function getDataWithNestedTagsAndCount() {
  const flatPages = await window.roamAlphaAPI.data.async.q(`[
    :find [(pull ?page [:block/uid :node/title 
      {:block/_refs [:block/string :block/uid 
        {:block/page 
          [
            :node/title :block/uid {:block/refs ...}
          ]
        }
        
         {:block/refs [:block/uid :node/title :block/string] }
        ]
      }
        ]) ...]
    :where
      [?block :block/refs ?page]
      [?page :node/title ?page-title]
      [?block :block/string ?block-string]
      [(clojure.string/includes? ?block-string "#")]
  ]`);

  // 1. 过滤出真正引用自身的块
  const filtered = flatPages
    .map((p) => ({
      ...p,
      refs: (p._refs || []).filter(
        (r) =>
          (r.string || "").includes(`#${p.title}`) ||
          (r.string || "").includes(`#[[${p.title}]]`)
      ),
    }))
    .filter((p) => p.refs.length);

  // 2. 按 tag 层级嵌套
  const nested = {}; // 根节点
  filtered.forEach((page) => {
    const chains = splitTags(page.title);
    if (chains.length) putChain(nested, chains, page);
  });

  console.log({ filtered });
  return nested;
}

function useSourcesAndPages() {
  const [tree, setTree] = React.useState({});
  const [activeTags, setActiveTags] = React.useState([]);
  const [isOpen, setIsOpen] = useDualColumnState();
  /* 首层排序状态 */
  const [sortKey, setSortKey] = React.useState("count");
  const [sortDir, setSortDir] = React.useState("desc");
  const [page, setPage] = React.useState(0);
  const [expanded, setExpanded] = React.useState(new Set());

  const onRefresh = () => getDataWithNestedTagsAndCount().then(setTree);
  useEffect(() => {
    onRefresh();

    const onBlur = () => {
      onRefresh();
    };
    document.body.leave(".rm-block-input", onBlur);
    return () => {
      document.body.unbindLeave(".rm-block-input", onBlur);
    };
  }, []);
  const alphaSortChange = (dir) => {
    setSortKey("alpha");
    setSortDir(dir);
    setPage(0);
  };

  const countSortChange = (dir) => {
    setSortKey("count");
    setSortDir(dir);
    setPage(0);
  };

  /* 仅对首层排序 & 分页 */
  const rootEntries = React.useMemo(() => {
    const list = Object.entries(tree);
    list.sort((a, b) => {
      let r = 0;
      if (sortKey === "count") r = b[1].count - a[1].count;
      else r = a[0].localeCompare(b[0]);
      return sortDir === "desc" ? r : -r;
    });
    const start = page * PAGE_SIZE;
    return list.slice(start, start + PAGE_SIZE);
  }, [tree, sortKey, sortDir, page]);

  /* 转 Blueprint TreeNodeInfo */
  const bpNodes = React.useMemo(
    () =>
      rootEntries.map(([name, tag]) => ({
        id: name,
        label: (
          <div
            className={`${
              activeTags.includes(name) ? "bp3-text-primary" : ""
            } tag-label`}
          >
            <Icon icon="tag" />
            {name}{" "}
            <span className="tag-count" style={{ fontSize: 12 }}>
              ({tag.count})
            </span>
          </div>
        ),
        tag,
        isExpanded: expanded.has(name), // 首层默认展开
        childNodes:
          Object.keys(tag.children).length > 0
            ? toBlueprintNodes(tag.children, 1, activeTags, expanded) // 子层不再排序
            : undefined,
      })),
    [rootEntries, activeTags, expanded]
  );
  const total = Object.keys(tree).length;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const [mode, setMode] = useModeState();
  const [currentTag, setCurrentTag] = useCurrentTagState();
  const renderToolbar = () => {
    return (
      <div className="tag-toolbar">
        <Button
          icon="arrow-left"
          minimal
          small
          disabled={page <= 0}
          onClick={() => setPage((p) => p - 1)}
        ></Button>
        <span>
          {page + 1} / {pageCount || 1}
        </span>
        <Button
          minimal
          small
          icon="arrow-right"
          disabled={page + 1 >= pageCount}
          onClick={() => setPage((p) => p + 1)}
        ></Button>

        <Button minimal small onClick={onRefresh} icon="refresh"></Button>
        <Tooltip content={"Change sort order"}>
          <Popover
            content={
              <Menu>
                <MenuItem
                  text="Count (desc)"
                  onClick={() => countSortChange("desc")}
                />
                <MenuItem
                  text="Count (asc)"
                  onClick={() => countSortChange("asc")}
                />
                <MenuDivider />
                <MenuItem
                  text="Title (a-z)"
                  onClick={() => alphaSortChange("asc")}
                />
                <MenuItem
                  text="Title (z-a)"
                  onClick={() => alphaSortChange("desc")}
                />
              </Menu>
            }
          >
            <Button
              small
              minimal
              active={sortKey !== "count" || sortDir !== "desc"}
              icon={(() => {
                if (sortKey === "alpha")
                  return sortDir === "desc"
                    ? "sort-alphabetical-desc"
                    : "sort-alphabetical";
                else return sortDir === "desc" ? "sort-desc" : "sort-asc";
              })()}
            />
          </Popover>
        </Tooltip>
        <Button
          minimal
          small
          active={isOpen}
          icon={isOpen ? "drawer-left" : "drawer-right"}
          onClick={() => {
            const onClose = () => {
              setIsOpen(false);
              close();
            };
            if (isOpen) {
              onClose();
            } else {
              setIsOpen(true);
              initEl();
            }
            setMode("tree");
          }}
        ></Button>
      </div>
    );
  };
  return {
    bpNodes,
    onRefresh,
    toggleExpand,
    renderToolbar,
    isSidebarOpen: isOpen,
  };
}

export default function Main() {
  const { bpNodes, toggleExpand, renderToolbar, isSidebarOpen } =
    useSourcesAndPages();

  const [mode, setMode] = useModeState();
  const [currentTag, setCurrentTag] = useCurrentTagState();

  const handleNodeClick = (node) => {
    const tag = node.tag;
    if (!tag) return;

    /* 1. 业务高亮（原逻辑） TODO */
    // const same = tag.pages?.[0]?.tags || [];
    // setActiveTags((prev) => (prev.includes(tag) ? [] : same));

    console.log({ tag });
    setCurrentTag(tag);

    if (!isSidebarOpen) {
      setMode("pages");
    }
  };

  return (
    <>
      {mode === "tree" ? (
        <>
          {renderToolbar()}
          <div className="tag-tree-container">
            <Tree
              contents={bpNodes}
              onNodeExpand={(n) => toggleExpand(n.id)}
              onNodeCollapse={(n) => toggleExpand(n.id)}
              onNodeClick={(n) => {
                handleNodeClick(n);
              }}
              className="tag-tree"
            />
          </div>
        </>
      ) : null}

      {mode === "pages" ? (
        <>
          <TagedPages onBack={() => setMode("tree")} tag={currentTag} />
        </>
      ) : null}
    </>
  );
}

/** 把一棵嵌套树转成 Blueprint TreeNodeInfo */
function toBlueprintNodes(obj, depth = 0, activeTags = [], expanded) {
  return Object.entries(obj).map(([name, tag]) => {
    const isActive = activeTags.includes(name);
    const id = `${depth}-${name}`;
    const node = {
      id, // 唯一即可
      label: (
        <div className={`${isActive ? "bp3-text-primary" : ""} tag-label`}>
          <Icon icon="tag" />
          {name}{" "}
          <span className="tag-count" style={{ fontSize: 12 }}>
            ({tag.count})
          </span>
        </div>
      ),
      // icon: IconNames.TAG,
      tag,
      childNodes:
        Object.keys(tag.children).length > 0
          ? toBlueprintNodes(tag.children, depth + 1, activeTags, expanded)
          : undefined,
      isExpanded: expanded.has(id), // 首层默认展开，子层按需
    };
    return node;
  });
}
