const tableOptions = [
  { key: "board", label: "胶板" },
  { key: "paint", label: "油漆" },
];

export function TableSelector({ value, onChange }) {
  return (
    <div className="table-selector" aria-label="目标多维表">
      {tableOptions.map((option) => (
        <button
          className={value === option.key ? "active" : ""}
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
