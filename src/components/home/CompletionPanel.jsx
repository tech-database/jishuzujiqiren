import { motion, useReducedMotion } from "framer-motion";
import { CountUpNumber } from "./CountUpNumber.jsx";
import { SectionFrame } from "./SectionFrame.jsx";

export function CompletionPanel({ summary }) {
  const total = Number(summary.total || 0);
  const done = Number(summary.done || 0);
  const rate = total > 0 ? Math.min(100, Math.max(0, (done / total) * 100)) : 0;
  const reduceMotion = useReducedMotion();

  return (
    <SectionFrame title="实时完成率" className="home-completion-panel">
      <div className="home-completion-body">
        <div className="home-donut">
          <span className="home-donut-ticks" aria-hidden="true" />
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="home-donut-track" cx="60" cy="60" r="50" pathLength="1" />
            <motion.circle
              className="home-donut-value"
              cx="60"
              cy="60"
              r="50"
              pathLength="1"
              initial={reduceMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: rate / 100 }}
              transition={{ duration: reduceMotion ? 0 : 1, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
          <div>
            <CountUpNumber value={rate} decimals={1} suffix="%" />
            <span><CountUpNumber value={done} /> / <CountUpNumber value={total} /></span>
          </div>
        </div>
        <div className="home-completion-legend">
          <span><i className="done" />已完成<CountUpNumber value={done} /></span>
          <span><i className="drawing" />绘图中<CountUpNumber value={summary.drawing || 0} /></span>
          <span><i className="unclaimed" />未领取<CountUpNumber value={summary.unclaimed || 0} /></span>
        </div>
      </div>
    </SectionFrame>
  );
}
