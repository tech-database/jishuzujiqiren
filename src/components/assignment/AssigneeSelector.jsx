import { useMemo, useState } from "react";
import { Check, UserRound } from "lucide-react";

function normalizePeople(rows = []) {
  return rows.map((row) => ({ id: String(row.id || "").trim(), name: String(row.name || "").trim() })).filter((row) => row.name);
}

export default function AssigneeSelector({ value, peopleRows, disabled, error, onChange }) {
  const [query, setQuery] = useState("");
  const people = useMemo(() => normalizePeople(peopleRows), [peopleRows]);
  const filteredPeople = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return people;
    return people.filter((person) => `${person.name} ${person.id}`.toLowerCase().includes(keyword));
  }, [people, query]);

  return (
    <section className="assignment-field-card assignment-assignee-step">
      <div className="assignment-step-heading">
        <span>2</span><div><h2>选择领取人</h2><p>可手工输入，也可从人员映射中搜索选择</p></div>
      </div>
      <label className="assignment-manual-assignee" htmlFor="assignment-assignee">
        <span>领取人姓名</span>
        <input
          id="assignment-assignee"
          value={value}
          disabled={disabled}
          placeholder="请输入领取人姓名"
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "assignment-assignee-error" : undefined}
        />
      </label>
      {people.length > 0 && (
        <>
          <input
            className="assignment-person-search"
            value={query}
            disabled={disabled}
            placeholder="搜索姓名或飞书用户 ID"
            onChange={(event) => setQuery(event.target.value)}
            aria-label="搜索领取人"
          />
          <div className="assignment-person-list" aria-label="可选领取人">
            {filteredPeople.length > 0 ? (
              filteredPeople.slice(0, 8).map((person) => {
                const selected = value === person.name;
                return (
                  <button className={selected ? "selected" : ""} type="button" key={`${person.id}:${person.name}`} onClick={() => onChange(person.name)} disabled={disabled} aria-pressed={selected}>
                    <span className="assignment-person-avatar"><UserRound size={17} /></span>
                    <span className="assignment-person-copy"><strong>{person.name}</strong><small>{person.id || "绘图员"}</small></span>
                    <span className="assignment-person-choice">{selected ? <Check size={14} /> : null}</span>
                  </button>
                );
              })
            ) : (
              <span>没有匹配的人员</span>
            )}
          </div>
        </>
      )}
      {error && <p className="assignment-field-error" id="assignment-assignee-error">{error}</p>}
    </section>
  );
}
