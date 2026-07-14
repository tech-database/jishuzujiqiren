export function GlassButton({ variant = "secondary", className = "", children, ...props }) {
  return (
    <button className={`glass-button ${variant} ${className}`.trim()} type="button" {...props}>
      {children}
    </button>
  );
}
