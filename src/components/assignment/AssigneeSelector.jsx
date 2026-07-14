import { useMemo, useState } from "react";

function normalizePeople(rows = []) {
  return rows
    .map((row) => ({
      id: String(row.id || "").trim(),
      name: String(row.name || "").trim(),
    }))
    .filter((row) => row.name);
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
    <section className="assignment-field-card">
      <label className="assignment-field-label" htmlFor="assignment-assignee">
        <span>领取人</span>
        <small>{people.length > 0 ? "来自人员映射，可搜索选择；也可保留手动输入" : "当前没有人员映射，使用手动输入"}</small>
      </label>
      <input
        id="assignment-assignee"
        value={value}
        disabled={disabled}
        placeholder="请输入或选择领取人姓名"
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "assignment-assignee-error" : undefined}
      />
      {people.length > 0 && (
        <>
          <input
            className="assignment-person-search"
            value={query}
            disabled={disabled}
            placeholder="搜索人员映射"
            onChange={(event) => setQuery(event.target.value)}
            aria-label="搜索领取人"
          />
          <div className="assignment-person-list" aria-label="可选领取人">
            {filteredPeople.length > 0 ? (
              filteredPeople.slice(0, 8).map((person) => (
                <button type="button" key={`${person.id}:${person.name}`} onClick={() => onChange(person.name)} disabled={disabled}>
                  <strong>{person.name}</strong>
                  {person.id && <code title={person.id}>{person.id}</code>}
                </button>
              ))
            ) : (
              <span>没有匹配的人员</span>
            )}
          </div>
        </>
      )}
      {error && (
        <p className="assignment-field-error" id="assignment-assignee-error">
          {error}
        </p>
      )}
    </section>
  );
}
