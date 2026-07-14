import { motion } from "framer-motion";

export function PageTransition({ children, className = "", as = "section" }) {
  const Component = motion[as] || motion.section;
  return (
    <Component
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Component>
  );
}
