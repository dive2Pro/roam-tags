import { Button, Menu, Tooltip } from "@blueprintjs/core";
import { useMemo, useState } from "react";
// 最底层：一条 block 的引用
export interface BlockRef {
  uid: string;
  string?: string; // 可能为空
  page?: {
    uid: string;
    title: string;
  };
}

// 一条 page 自身的数据
export interface PageItem {
  uid: string;
  title: string;
  _refs?: BlockRef[]; // 原始全量引用（可选）
  refs: BlockRef[]; // 当前要展示的引用
}

// 一个 tag 节点
export interface TagNode {
  pages: PageItem[];
  count: number;
  children: Record<string, TagNode>; // 子层
}

// 根对象
export type TagRoot = Record<string, TagNode>;

/**
 * 深度拷贝并合并 refs（相同 title 只保留第一条）
 */
export function cloneAndMergeRefs(root: TagNode) {
  const seen = new Map<string, BlockRef[]>();
  function mergePageRefs(page: PageItem) {
    page.refs.forEach((r) => {
      const t = r.page?.title ?? r.uid;
      if (!seen.has(t)) {
        seen.set(t, [r]);
      } else {
        const refs = seen.get(t) || [];
        refs.push(r);
      }
    });

    return { ...page, refs: seen };
  }

  function cloneNode(node: TagNode) {
    return node.pages.map(mergePageRefs)[0];
    // return {
    //   pages: node.pages.map(mergePageRefs),
    //   count: node.count,
    //   // children: Object.fromEntries(
    //   //   Object.entries(node.children)?.map(([k, v]) => [k, cloneNode(v)])
    //   // ),
    //   children: node.children,
    // };
  }

  return cloneNode(root);
}

export function getTagRefs() {}

type Page = {
  uid: string;
  title: string;
  string?: string;
  page: {
    uid: string;
    title: string;
  };
};

export function TagedPages({
  tag,
  onBack,
}: {
  tag: TagNode;
  onBack: () => void;
}) {
  const pageList = useMemo(() => cloneAndMergeRefs(tag), [tag]);
  return (
    <>
      <Button
        icon="arrow-left"
        minimal
        onClick={onBack}
        style={{ marginBottom: 8 }}
      >
        返回树形视图
      </Button>
      <Menu
        className="bp3-dark"
        style={{
          overflow: "auto",
        }}
      >
        {Array.from(pageList.refs.entries()).map(([name, p]) => {
          console.log({ name, p });
          return p.map((r) => (
            <Menu.Item
              key={r.uid}
              text={r.string ?? r.uid}
              labelElement={<small>{name}</small>}
              onClick={() => {
                window.roamAlphaAPI.ui.mainWindow.openBlock({
                  block: {
                    uid: r.uid,
                  },
                });
              }}
            />
          ));
          //   return (
          //     <Menu.Item key={name} text={name} onClick={() => {
          //         window.roamAlphaAPI.ui.mainWindow.openPage({
          //             page: {
          //                 // uid: name,
          //                 title: name
          //             },
          //         });
          //     }}>
          //       {/* {p.map(r => {
          //                 return <Menu.Item key={r.uid} text={r.string ?? r.uid} />
          //             })} */}
          //     </Menu.Item>
          //   );
        })}
      </Menu>
    </>
  );
}
