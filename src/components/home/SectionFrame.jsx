export function SectionFrame({ title, meta, children, className = "" }) {
  return (
    <section className={`home-panel ${className}`}>
      <header className="home-panel-header">
        <h2>{title}</h2>
        {meta && <span>{meta}</span>}
      </header>
      {children}
    </section>
  );
}
