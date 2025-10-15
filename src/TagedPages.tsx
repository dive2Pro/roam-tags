import {
  Button,
  ButtonGroup,
  Classes,
  Icon,
  Menu,
  MenuDivider,
  MenuItem,
  Popover,
  Switch,
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
  const { groupBy, sortBy, setGroupBy, setSortBy } = usePageGroupSort();

  const pageMap = useMemo(() => {
    if (!tag) {
      return null;
    }
    return mergeRefs(tag, showDescendants);
  }, [tag, showDescendants]);
  console.log({ tag });
  return (
    <div className="taged-list">
      <div className="taged-toolbar">
        <Button icon="drawer-right" small minimal onClick={onBack}></Button>

        <ButtonGroup>
          <ViewSettingsMenu
            groupBy={groupBy}
            sortBy={sortBy}
            setGroupBy={setGroupBy}
            setSortBy={setSortBy}
          />
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
        </ButtonGroup>
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
    </div>
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

type GroupBy = "none" | "page" | "editDate";
type SortBy =
  | "editNewFirst"
  | "editOldFirst"
  | "createNewFirst"
  | "createOldFirst"
  | "titleAsc"
  | "titleDesc";

interface Return {
  groupBy: GroupBy;
  sortBy: SortBy;
  setGroupBy: (g: GroupBy) => void;
  setSortBy: (s: SortBy) => void;
}

export function usePageGroupSort(): Return {
  const [groupBy, setGroupBy] = useState<GroupBy>("page")
  const [sortBy, setSortBy] = useState<SortBy>("editNewFirst");

  return { groupBy, sortBy, setGroupBy, setSortBy };
}

export const ViewSettingsMenu = (props: Return) => {
  const { groupBy, sortBy, setGroupBy, setSortBy } = props;

  const handleGroupToggle = (val: GroupBy) => () => {
    // 互斥：同一时刻只能按 page 或按 editDate 或不 group
    setGroupBy(groupBy === val ? "none" : val);
  };

  const handleSort = (s: SortBy) => () => setSortBy(s);

  const showTitleSort = groupBy === "page";

  return (
    // @ts-ignore
    <Popover
      position="bottom-right"
      autoFocus={false}
      popoverClassName="taged-menu"
      enforceFocus={false}
      content={
        <Menu>
          <div>
            <strong>Group</strong>
          </div>
          <Switch
            alignIndicator="right"
            checked={groupBy === "page"}
            labelElement={<span>Group by page</span>}
            onChange={handleGroupToggle("page")}
          />

          <Switch
            alignIndicator="right"
            checked={groupBy === "editDate"}
            labelElement={<span>Group by edit date</span>}
            onChange={handleGroupToggle("editDate")}
          />

          <div>
            <strong>Sort by</strong>
          </div>
          {!showTitleSort ? (
            <>
              <MenuItem
                text="Date edited (newest on top)"
                active={sortBy === "editNewFirst"}
                icon={sortBy === "editNewFirst" ? "tick" : 'blank'}
                onClick={handleSort("editNewFirst")}
                shouldDismissPopover={false}
              />
              <MenuItem
                text="Date edited (oldest on top)"
                active={sortBy === "editOldFirst"}
                onClick={handleSort("editOldFirst")}
                icon={sortBy === "editOldFirst" ? "tick" : 'blank'}
                shouldDismissPopover={false}
              />
              <MenuItem
                text="Date created (newest on top)"
                active={sortBy === "createNewFirst"}
                onClick={handleSort("createNewFirst")}
                icon={sortBy === "createNewFirst" ? "tick" : 'blank'}
                shouldDismissPopover={false}
              />
              <MenuItem
                text="Date created (oldest on top)"
                active={sortBy === "createOldFirst"}
                onClick={handleSort("createOldFirst")}
                icon={sortBy === "createOldFirst" ? "tick" : 'blank'}
                shouldDismissPopover={false}
              />
            </>
          ) : null}

          {/* 仅当 groupBy === 'page' 时才渲染 Title 排序 */}
          {showTitleSort && (
            <>
              <MenuItem
                text="Title (a-z)"
                active={sortBy === "titleAsc"}
                onClick={handleSort("titleAsc")}
              />
              <MenuItem
                text="Title (z-a)"
                active={sortBy === "titleDesc"}
                onClick={handleSort("titleDesc")}
              />
            </>
          )}
        </Menu>
      }
    >
      <Button small minimal icon="settings" />
    </Popover>
  );
};
