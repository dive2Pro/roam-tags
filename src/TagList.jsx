import React from "react";
import { Tree } from "@blueprintjs/core";

const sortEntries = (entries, sortKey, sortDir) =>
  entries.sort((a, b) => {
    let res = 0;
    if (sortKey === "count") {
      res = b[1].count - a[1].count; // 默认降序
    } else {
      res = a[0].localeCompare(b[0]); // 默认升序
    }
    // 如果需要逆序，则乘以 -1
    return sortDir === "desc" ? res : -res;
  });

const PAGE_SIZE = 20;

// 把 "A/B/C" 变成 ["A","B","C"]
const splitTags = (title = "") =>
  title
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);

// 把一条 tagChain 写进树，并沿途累加 count
const putChain = (root, tagChain, page) => {
  let cur = root;
  tagChain.forEach((tag) => {
    if (!cur[tag]) cur[tag] = { pages: [], count: 0, children: {} };
    cur[tag].count += page.refs.length; // 每经过一次就 +1
    cur = cur[tag].children;
  });
  // console.log(page,cur, tagChain, root);
  // 叶子节点挂 page
  const leafContainer = tagChain
    .slice(0, Math.max(0, tagChain.length))
    .reduce((o, t, index, arr) => {
      if (index === arr.length - 1) {
        return o[t];
      }
      return o[t].children;
    }, root);

  if (tagChain[0] === "roam") {
    console.log(leafContainer, page, tagChain);
  }
  if (
    leafContainer.pages &&
    !leafContainer.pages?.find((p) => p.uid === page.uid)
  ) {
    leafContainer.pages.push(page);
  }
};

async function getDataWithNestedTagsAndCount() {
  const flatPages = await window.roamAlphaAPI.data.async.q(`[
      :find [(pull ?page [:block/uid :node/title {:block/_refs [:block/string :block/uid {:block/page [:node/title :block/uid]}]}]) ...]
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

  return nested;
}

function TagNode({
  tag,
  pages,
  count,
  children,
  depth,
  activeTags,
  onTagClick,
}) {
  const active = activeTags.includes(tag);
  return (
    <div
      className={`tag-node ${active ? "active" : "inactive"}`}
      style={{ marginLeft: depth * 16 }}
      onClick={() => onTagClick(tag, pages[0])}
    >
      <span className="tag-label">
        {tag} <span className="count">({count})</span>
      </span>
      {pages.map((p) => (
        <div key={p.uid} className="page-link">
          <a href={`#/app/page/${p.uid}`}>{p.title}</a>
        </div>
      ))}
      {Object.keys(children).length > 0 &&
        Object.entries(children).map(([childTag, v]) => (
          <TagNode
            key={childTag}
            tag={childTag}
            pages={v.pages}
            count={v.count}
            children={v.children}
            depth={depth + 1}
            activeTags={activeTags}
            onTagClick={onTagClick}
          />
        ))}
    </div>
  );
}

export default function Main() {
  const [tree, setTree] = React.useState({});
  const [activeTags, setActiveTags] = React.useState([]);
  /* 首层排序状态 */
  const [sortKey, setSortKey] = React.useState("count"); // 'count' | 'alpha'
  const [sortDir, setSortDir] = React.useState("desc"); // 'asc' | 'desc'
  const [page, setPage] = React.useState(0);
  const [expanded, setExpanded] = React.useState(new Set());

  const onRefresh = () => getDataWithNestedTagsAndCount().then(setTree);

  /* 排序切换 */
  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "count" ? "desc" : "asc");
    }
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
      rootEntries.map(([tag, { pages, count, children }]) => ({
        id: tag,
        label: (
          <span
            className={activeTags.includes(tag) ? "bp4-text-primary" : ""}
            onClick={(e) => {
              e.stopPropagation();
              // handleTagClick(tag, pages[0]);
            }}
            style={{ cursor: "pointer" }}
          >
            {tag} <span className="tag-count" style={{ fontSize: 12 }}>({count})</span>
          </span>
        ),
        isExpanded: expanded.has(tag), // 首层默认展开
        childNodes:
          Object.keys(children).length > 0
            ? toBlueprintNodes(children, 1, activeTags, expanded) // 子层不再排序
            : undefined,
      })),
    [rootEntries, activeTags, expanded]
  );

  const total = Object.keys(tree).length;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const toggleExpand = (id) => {
    console.log("toggleExpand", id);
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <>
      <button onClick={onRefresh}>Refresh</button>

      {/* 首层控制栏 */}
      <div className="root-bar">
        <button onClick={() => toggleSort("count")}>
          Count {sortKey === "count" && (sortDir === "desc" ? "↓" : "↑")}
        </button>
        <button onClick={() => toggleSort("alpha")}>
          A-Z {sortKey === "alpha" && (sortDir === "asc" ? "↑" : "↓")}
        </button>

        <span className="pager">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            ‹
          </button>
          {page + 1} / {pageCount || 1}
          <button
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            ›
          </button>
        </span>
      </div>

      {/* 首层节点渲染 */}
      {/* <div className="tag-tree">
        {rootEntries.map(([tag, { pages, count, children }]) => (
          <TagNode
            key={tag}
            tag={tag}
            pages={pages}
            count={count}
            children={children}
            depth={0}
            activeTags={activeTags}
            onTagClick={handleTagClick}
          />
        ))}
      </div> */}
      <div
        className="tag-tree-container"
      >
        <Tree
          contents={bpNodes}
          onNodeExpand={(n) => toggleExpand(n.id)}
          onNodeCollapse={(n) => toggleExpand(n.id)}
          onNodeClick={(n) => console.log("click", n)}
          className="tag-tree"
        />
      </div>
    </>
  );
}

/** 把一棵嵌套树转成 Blueprint TreeNodeInfo */
function toBlueprintNodes(obj, depth = 0, activeTags = [], expanded) {
  return Object.entries(obj).map(([tag, { pages, count, children }]) => {
    const isActive = activeTags.includes(tag);
    const id = `${depth}-${tag}`;
    const node = {
      id, // 唯一即可
      label: (
        <span className={isActive ? "bp4-text-primary" : ""}>
          {tag} <span className="tag-count" style={{ fontSize: 12 }}>({count})</span>
        </span>
      ),
      // icon: IconNames.TAG,
      childNodes:
        Object.keys(children).length > 0
          ? toBlueprintNodes(children, depth + 1, activeTags, expanded)
          : undefined,
      isExpanded: expanded.has(id), // 首层默认展开，子层按需
    };
    return node;
  });
}
