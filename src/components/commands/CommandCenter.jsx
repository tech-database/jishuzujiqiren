import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { PageTransition } from "../motion";
import { filterCommands, getCommandCopyText, normalizeCommands } from "../../utils/commandUtils";
import CommandCard from "./CommandCard";
import CommandDialog from "./CommandDialog";
import CommandEmptyState from "./CommandEmptyState";
import CommandToolbar from "./CommandToolbar";

export default function CommandCenter({ commands = [], onRefresh }) {
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
      <CommandToolbar
        query={query}
        onQueryChange={setQuery}
        total={normalizedCommands.length}
        filtered={visibleCommands.length}
        onRefresh={onRefresh}
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
        <AlertTriangle size={19} aria-hidden="true" />
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
