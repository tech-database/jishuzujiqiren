import { motion } from "framer-motion";

export function HoverCard({ children, className = "", as = "article", ...props }) {
  const Component = motion[as] || motion.article;
  return (
    <Component
      className={`hover-motion-card ${className}`.trim()}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      {...props}
    >
      {children}
    </Component>
  );
}
