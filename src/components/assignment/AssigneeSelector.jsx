import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

function normalizePeople(rows = []) {
  return [
    ...new Set(
      rows
        .map((row) => String(row.name || "").trim())
        .filter(Boolean),
    ),
  ];
}

export default function AssigneeSelector({ value, peopleRows, disabled, error, onChange }) {
  const [filterText, setFilterText] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const comboboxRef = useRef(null);
  const people = useMemo(() => normalizePeople(peopleRows), [peopleRows]);
  const filteredPeople = useMemo(() => {
    const keyword = filterText.trim().toLowerCase();
    if (!keyword) return people;
    return people.filter((name) => name.toLowerCase().includes(keyword));
  }, [filterText, people]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!comboboxRef.current?.contains(event.target)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const showOptions = () => {
    if (disabled || people.length === 0) return;
    setFilterText("");
    setActiveIndex(-1);
    setOpen(true);
  };

  const selectPerson = (name) => {
    onChange(name);
    setFilterText("");
    setActiveIndex(-1);
    setOpen(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setFilterText("");
      }
      if (filteredPeople.length === 0) return;
      setActiveIndex((current) => {
        if (event.key === "ArrowDown") return current >= filteredPeople.length - 1 ? 0 : current + 1;
        return current <= 0 ? filteredPeople.length - 1 : current - 1;
      });
      return;
    }
    if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      selectPerson(filteredPeople[activeIndex]);
    }
  };

  return (
    <div className="assignment-manual-assignee assignment-summary-assignee">
      <label htmlFor="assignment-assignee">选择领取人</label>
      <div
        className="assignment-assignee-combobox"
        ref={comboboxRef}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setOpen(false);
            setActiveIndex(-1);
          }
        }}
      >
        <input
          id="assignment-assignee"
          data-testid="assignee-input"
          value={value}
          disabled={disabled}
          placeholder={people.length > 0 ? "点击选择领取人" : "请输入领取人姓名"}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="assignment-assignee-options"
          aria-expanded={open}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "assignment-assignee-error" : undefined}
          aria-activedescendant={
            open && activeIndex >= 0 ? `assignment-assignee-option-${activeIndex}` : undefined
          }
          onClick={showOptions}
          onFocus={showOptions}
          onChange={(event) => {
            setFilterText(event.target.value);
            setActiveIndex(-1);
            setOpen(people.length > 0);
            onChange(event.target.value);
          }}
          onKeyDown={handleKeyDown}
        />
        <ChevronDown
          className={open ? "assignment-assignee-chevron open" : "assignment-assignee-chevron"}
          size={17}
          aria-hidden="true"
        />
        {open && (
          <div
            className="assignment-assignee-dropdown"
            id="assignment-assignee-options"
            role="listbox"
            aria-label="可选领取人姓名"
          >
            {filteredPeople.length > 0 ? (
              filteredPeople.map((name, index) => {
                const selected = value === name;
                return (
                  <button
                    className={selected || activeIndex === index ? "selected" : ""}
                    id={`assignment-assignee-option-${index}`}
                    type="button"
                    role="option"
                    key={name}
                    aria-selected={selected}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectPerson(name)}
                    disabled={disabled}
                  >
                    <span>{name}</span>
                    {selected && <Check size={15} aria-hidden="true" />}
                  </button>
                );
              })
            ) : (
              <span className="assignment-assignee-empty">没有匹配的姓名</span>
            )}
          </div>
        )}
      </div>
      {error && <p className="assignment-field-error" id="assignment-assignee-error">{error}</p>}
    </div>
  );
}
