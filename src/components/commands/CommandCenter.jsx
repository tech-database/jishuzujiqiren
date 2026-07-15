import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, ClipboardList, LockKeyhole, MessageSquareText } from "lucide-react";
import { PageHeader, StatusBadge } from "../design-system";
import { PageTransition } from "../motion";
import { filterCommands, getCommandCopyText, normalizeCommands } from "../../utils/commandUtils";
import CommandCard from "./CommandCard";
import CommandDialog from "./CommandDialog";
import CommandEmptyState from "./CommandEmptyState";
import CommandToolbar from "./CommandToolbar";

export default function CommandCenter({ commands = [] }) {
  const [query, setQuery] = useState("");
  const [selectedCommand, setSelectedCommand] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const copiedTimerRef = useRef(null);

  useEffect(() => {
    return () => window.clearTimeout(copiedTimerRef.current);
  }, []);

  const normalizedCommands = useMemo(() => normalizeCommands(commands), [commands]);
  const visibleCommands = useMemo(
    () => filterCommands(normalizedCommands, query),
    [normalizedCommands, query],
  );

  const copyCommand = async (command) => {
    const text = getCommandCopyText(command);
    if (!text) return;

    await navigator.clipboard?.writeText(text);
    setCopiedId(command.id);
    window.clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = window.setTimeout(() => {
      setCopiedId((current) => (current === command.id ? null : current));
    }, 1400);
  };

  return (
    <PageTransition className="command-center">
      <PageHeader
        icon={<Bot size={24} />}
        title="机器人口令中心"
        description="飞书机器人口令清单与触发说明。当前项目未提供口令管理接口，因此本页仅展示真实可用口令。"
        actions={(
          <>
            <StatusBadge tone="neutral">只读模式</StatusBadge>
            <StatusBadge tone={normalizedCommands.length > 0 ? "success" : "warning"}>
              {normalizedCommands.length > 0 ? "口令已加载" : "暂无数据"}
            </StatusBadge>
          </>
        )}
      />

      <section className="command-hero-panel">
        <motion.div
          className="command-hero-copy"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="command-hero-icon">
            <MessageSquareText size={22} />
          </span>
          <div>
            <h2>机器人指令管理中心</h2>
            <p>
              将群聊中的自然语言触发口令整理为可搜索、可复制、可审阅的控制台视图；不展示没有接口来源的执行次数、成功率或最近同步时间。
            </p>
          </div>
        </motion.div>
        <div className="command-capability-grid">
          <span>
            <ClipboardList size={18} />
            真实口令清单
          </span>
          <span>
            <LockKeyhole size={18} />
            管理接口未开放
          </span>
        </div>
      </section>

      <CommandToolbar
        query={query}
        onQueryChange={setQuery}
        total={normalizedCommands.length}
        filtered={visibleCommands.length}
      />

      {visibleCommands.length > 0 ? (
        <motion.section className="robot-command-grid" layout>
          <AnimatePresence mode="popLayout">
            {visibleCommands.map((command, index) => (
              <CommandCard
                key={command.id}
                command={command}
                index={index}
                copied={copiedId === command.id}
                onCopy={copyCommand}
                onView={setSelectedCommand}
              />
            ))}
          </AnimatePresence>
        </motion.section>
      ) : (
        <CommandEmptyState hasQuery={Boolean(query.trim())} onClear={() => setQuery("")} />
      )}

      <section className="command-readonly-note">
        <strong>能力边界</strong>
        <span>
          本页没有创建新增、编辑、删除或启停控件，因为当前后端没有对应接口和字段。后续如需真正管理口令，应先补充后端数据模型与 CRUD API。
        </span>
      </section>

      <CommandDialog
        command={selectedCommand}
        copied={selectedCommand ? copiedId === selectedCommand.id : false}
        onClose={() => setSelectedCommand(null)}
        onCopy={copyCommand}
      />
    </PageTransition>
  );
}
