import {
  Button,
  ButtonGroup,
  Icon,
  Menu,
  MenuDivider,
  MenuItem,
  Tooltip,
} from "@blueprintjs/core";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useCurrentTagState,
  useShowDescendantsState,
} from "./useSingletonState";
import { type } from "os";
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
  page: PageItem;
  count: number;
  children: Record<string, TagNode>; // 子层
}

// 根对象
export type TagRoot = Record<string, TagNode>;

export function mergeRefs(root: TagNode, showDescendants: boolean) {
  const seen = new Map<string, BlockRef[]>();
  function mergePageRefs(node: TagNode) {
    node.page?.refs?.forEach((r) => {
      const t = r.page?.title ?? r.uid;
      if (!seen.has(t)) {
        seen.set(t, [r]);
      } else {
        const refs = seen.get(t) || [];
        refs.push(r);
      }
    });
    if (showDescendants) {
      Object.values(node.children).forEach(mergePageRefs);
    }
  }
  mergePageRefs(root);
  return seen;
}

export function TagedPages({ onBack }: { onBack: () => void }) {
  const [tag] = useCurrentTagState();
  const [showDescendants, setShowDescendants] = useShowDescendantsState();
  const pageMap = useMemo(() => {
    if (!tag) {
      return null;
    }
    return mergeRefs(tag, showDescendants);
  }, [tag, showDescendants]);
  console.log({ tag });
  return (
    <>
      <div className="taged-toolbar">
        <Button
          icon="arrow-left"
          small
          onClick={onBack}
          style={{ marginBottom: 8 }}
        ></Button>
        {/* @ts-ignore */}
        <Tooltip position="bottom" content={"show notes from descendants"}>
          <Button
            minimal
            onClick={() => setShowDescendants(!showDescendants)}
            icon="layers"
            active={showDescendants}
            small
          ></Button>
        </Tooltip>
      </div>
      {/* <div style={{
      }}>
        <Icon icon="tag"></Icon>
        <span style={{ marginLeft: 4, fontSize: 16 }}>
          {pageList.title}
          <small style={{ marginLeft: 4 }}>{tag.count}</small>
        </span>
      </div> */}
      {!pageMap ? null : (
        <Menu
          style={{
            overflow: "auto",
            height: "100%",
          }}
        >
          {Array.from(pageMap.entries()).map(([name, p]) => {
            return (
              <>
                <div
                  onClick={(e) => {
                    if (e.shiftKey) {
                      window.roamAlphaAPI.ui.rightSidebar.addWindow({
                        window: {
                          type: "block",
                          "block-uid": p[0].page?.uid,
                        },
                      });
                      return;
                    }
                    window.roamAlphaAPI.ui.mainWindow.openPage({
                      page: {
                        uid: p[0].page?.uid ?? p[0].uid,
                      },
                    });
                  }}
                >
                  <MenuDivider title={name} />
                </div>
                {p.map((r) => (
                  <Menu.Item
                    key={r.uid}
                    text={<RoamBlockString text={r.string ?? r.uid} />}
                    //   labelElement={<small>{name}</small>}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (e.shiftKey) {
                        window.roamAlphaAPI.ui.rightSidebar.addWindow({
                          window: {
                            type: "block",
                            "block-uid": r.uid,
                          },
                        });
                        return;
                      }
                      window.roamAlphaAPI.ui.mainWindow.openBlock({
                        block: {
                          uid: r.uid,
                        },
                      });
                    }}
                  />
                ))}
              </>
            );
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
      )}
    </>
  );
}

function RoamBlockString({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    // @ts-ignore
    // window.roamAlphaAPI.ui.components.renderString({
    //   el: ref.current,
    //   string: text,
    // });
  }, [text]);
  //   return <span ref={ref}>{text}</span>;
  return <>{text}</>;
}
