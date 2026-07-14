import { AnimatePresence, motion } from "framer-motion";

export function LiveLog({ items = [], className = "" }) {
  return (
    <div className={`live-log ${className}`.trim()} role="log" aria-live="polite">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.div
            className={`live-log-row ${item.tone || "info"}`}
            key={item.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <time>{item.time}</time>
            <span>{item.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
