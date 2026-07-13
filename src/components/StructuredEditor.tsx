import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  emptySection,
  SECTION_KINDS,
  stringifyResume,
  type Job,
  type ResumeData,
  type School,
  type Section,
  type SkillGroup,
} from "../lib/tauri";

interface Props {
  initialJson: string;
  onChange: (json: string) => void;
  onSave: () => void;
  onCompile: () => void;
}

function parse(json: string): ResumeData {
  return JSON.parse(json);
}

export function StructuredEditor({ initialJson, onChange, onSave, onCompile }: Props) {
  const [data, setData] = useState<ResumeData | null>(() => {
    try {
      return parse(initialJson);
    } catch {
      return null;
    }
  });
  const [parseError] = useState<string | null>(() => {
    try {
      parse(initialJson);
      return null;
    } catch (e) {
      return String(e);
    }
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey && e.key === "s") {
        e.preventDefault();
        onSave();
      } else if (e.metaKey && e.key === "b") {
        e.preventDefault();
        onCompile();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave, onCompile]);

  function update(next: ResumeData) {
    setData(next);
    onChange(stringifyResume(next));
  }

  if (parseError || !data) {
    return (
      <div className="structured structured--error">
        <h3>Couldn't parse resume JSON</h3>
        <pre>{parseError}</pre>
      </div>
    );
  }

  function updateSection(index: number, patch: Section) {
    if (!data) return;
    const sections = data.sections.slice();
    sections[index] = patch;
    update({ ...data, sections });
  }

  function removeSection(index: number) {
    if (!data) return;
    const sections = data.sections.slice();
    sections.splice(index, 1);
    update({ ...data, sections });
  }

  function moveSection(index: number, dir: -1 | 1) {
    if (!data) return;
    const sections = data.sections.slice();
    const j = index + dir;
    if (j < 0 || j >= sections.length) return;
    [sections[index], sections[j]] = [sections[j], sections[index]];
    update({ ...data, sections });
  }

  function addSection(kind: Section["kind"]) {
    if (!data) return;
    update({ ...data, sections: [...data.sections, emptySection(kind)] });
  }

  return (
    <div className="structured">
      <section className="structured__header">
        <Field label="Name">
          <input
            value={data.name}
            onChange={(e) => update({ ...data, name: e.target.value })}
          />
        </Field>
        <Field label="Headline">
          <input
            value={data.headline}
            onChange={(e) => update({ ...data, headline: e.target.value })}
          />
        </Field>
        <Field label="Email">
          <input
            value={data.email}
            onChange={(e) => update({ ...data, email: e.target.value })}
          />
        </Field>
      </section>

      {data.sections.map((section, i) => (
        <SectionBlock
          key={i}
          section={section}
          index={i}
          total={data.sections.length}
          onChange={(s) => updateSection(i, s)}
          onRemove={() => removeSection(i)}
          onMove={(dir) => moveSection(i, dir)}
        />
      ))}

      <div className="structured__add">
        <span>Add section:</span>
        {SECTION_KINDS.map((k) => (
          <button key={k} type="button" onClick={() => addSection(k)}>
            + {k}
          </button>
        ))}
      </div>
    </div>
  );
}

function AutoTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function resize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const cs = window.getComputedStyle(el);
    const borderTop = parseFloat(cs.borderTopWidth) || 0;
    const borderBottom = parseFloat(cs.borderBottomWidth) || 0;
    el.style.height = el.scrollHeight + borderTop + borderBottom + "px";
  }

  useLayoutEffect(() => {
    resize();
  }, [props.value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (Math.abs(w - lastWidth) > 0.5) {
        lastWidth = w;
        resize();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return <textarea ref={ref} {...props} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="structured__field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SectionBlock({
  section,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  section: Section;
  index: number;
  total: number;
  onChange: (next: Section) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <section className="structured__section">
      <header className="structured__section-head">
        <h3>{section.kind}</h3>
        <div className="structured__section-actions">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} title="Move up">
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            title="Move down"
          >
            ↓
          </button>
          <button type="button" onClick={onRemove} title="Remove section">
            ✕
          </button>
        </div>
      </header>
      {renderSectionBody(section, onChange)}
    </section>
  );
}

function renderSectionBody(section: Section, onChange: (next: Section) => void) {
  switch (section.kind) {
    case "summary":
      return (
        <StringList
          values={section.bullets}
          onChange={(bullets) => onChange({ ...section, bullets })}
          multiline
          placeholder="Bullet point"
        />
      );
    case "skills":
      return (
        <GroupList
          groups={section.groups}
          onChange={(groups) => onChange({ ...section, groups })}
        />
      );
    case "experience":
      return (
        <JobList jobs={section.jobs} onChange={(jobs) => onChange({ ...section, jobs })} />
      );
    case "certifications":
      return (
        <StringList
          values={section.items}
          onChange={(items) => onChange({ ...section, items })}
          placeholder="Certification"
        />
      );
    case "education":
      return (
        <SchoolList
          schools={section.schools}
          onChange={(schools) => onChange({ ...section, schools })}
        />
      );
  }
}

function StringList({
  values,
  onChange,
  placeholder,
  multiline,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  function set(i: number, v: string) {
    const next = values.slice();
    next[i] = v;
    onChange(next);
  }
  function remove(i: number) {
    const next = values.slice();
    next.splice(i, 1);
    onChange(next);
  }
  function move(i: number, dir: -1 | 1) {
    const next = values.slice();
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function add() {
    onChange([...values, ""]);
  }
  return (
    <div className="structured__list">
      {values.map((v, i) => (
        <div className="structured__row" key={i}>
          {multiline ? (
            <AutoTextarea
              value={v}
              onChange={(e) => set(i, e.target.value)}
              placeholder={placeholder}
              rows={1}
            />
          ) : (
            <input value={v} onChange={(e) => set(i, e.target.value)} placeholder={placeholder} />
          )}
          <RowActions
            onUp={() => move(i, -1)}
            onDown={() => move(i, 1)}
            onRemove={() => remove(i)}
            upDisabled={i === 0}
            downDisabled={i === values.length - 1}
          />
        </div>
      ))}
      <button type="button" className="structured__add-row" onClick={add}>
        + Add
      </button>
    </div>
  );
}

function GroupList({
  groups,
  onChange,
}: {
  groups: SkillGroup[];
  onChange: (next: SkillGroup[]) => void;
}) {
  function set(i: number, patch: Partial<SkillGroup>) {
    const next = groups.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function remove(i: number) {
    const next = groups.slice();
    next.splice(i, 1);
    onChange(next);
  }
  function move(i: number, dir: -1 | 1) {
    const next = groups.slice();
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function add() {
    onChange([...groups, { label: "", items: "" }]);
  }
  return (
    <div className="structured__list">
      {groups.map((g, i) => (
        <div className="structured__row structured__row--group" key={i}>
          <input
            className="structured__group-label"
            value={g.label}
            onChange={(e) => set(i, { label: e.target.value })}
            placeholder="Group label"
          />
          <AutoTextarea
            value={g.items}
            onChange={(e) => set(i, { items: e.target.value })}
            placeholder="Comma-separated items"
            rows={1}
          />
          <RowActions
            onUp={() => move(i, -1)}
            onDown={() => move(i, 1)}
            onRemove={() => remove(i)}
            upDisabled={i === 0}
            downDisabled={i === groups.length - 1}
          />
        </div>
      ))}
      <button type="button" className="structured__add-row" onClick={add}>
        + Add group
      </button>
    </div>
  );
}

function JobList({ jobs, onChange }: { jobs: Job[]; onChange: (next: Job[]) => void }) {
  function set(i: number, patch: Partial<Job>) {
    const next = jobs.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function remove(i: number) {
    const next = jobs.slice();
    next.splice(i, 1);
    onChange(next);
  }
  function move(i: number, dir: -1 | 1) {
    const next = jobs.slice();
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function add() {
    onChange([
      ...jobs,
      { company: "", role: "", dates: "", summary: "", bullets: [""] },
    ]);
  }
  return (
    <div className="structured__list">
      {jobs.map((job, i) => (
        <div className="structured__job" key={i}>
          <div className="structured__job-head">
            <input
              value={job.company}
              onChange={(e) => set(i, { company: e.target.value })}
              placeholder="Company"
            />
            <input
              value={job.role}
              onChange={(e) => set(i, { role: e.target.value })}
              placeholder="Role"
            />
            <input
              value={job.dates}
              onChange={(e) => set(i, { dates: e.target.value })}
              placeholder="Dates"
            />
            <RowActions
              onUp={() => move(i, -1)}
              onDown={() => move(i, 1)}
              onRemove={() => remove(i)}
              upDisabled={i === 0}
              downDisabled={i === jobs.length - 1}
            />
          </div>
          <AutoTextarea
            value={job.summary}
            onChange={(e) => set(i, { summary: e.target.value })}
            placeholder="Summary paragraph"
            rows={2}
          />
          <Field label="Bullets">
            <StringList
              values={job.bullets ?? []}
              onChange={(bullets) => set(i, { bullets })}
              multiline
              placeholder="Bullet point"
            />
          </Field>
          <Field label="Highlight (optional)">
            <div className="structured__highlight">
              <input
                value={job.highlight?.label ?? ""}
                onChange={(e) =>
                  set(i, {
                    highlight: {
                      label: e.target.value,
                      text: job.highlight?.text ?? "",
                    },
                  })
                }
                placeholder="Highlight label (e.g. Award name)"
              />
              <AutoTextarea
                value={job.highlight?.text ?? ""}
                onChange={(e) =>
                  set(i, {
                    highlight: {
                      label: job.highlight?.label ?? "",
                      text: e.target.value,
                    },
                  })
                }
                placeholder="Highlight text"
                rows={1}
              />
              {job.highlight && (
                <button
                  type="button"
                  className="structured__inline-btn"
                  onClick={() => {
                    const { highlight: _h, ...rest } = job;
                    void _h;
                    onChange(jobs.map((j, idx) => (idx === i ? rest : j)));
                  }}
                >
                  Remove highlight
                </button>
              )}
            </div>
          </Field>
        </div>
      ))}
      <button type="button" className="structured__add-row" onClick={add}>
        + Add job
      </button>
    </div>
  );
}

function SchoolList({
  schools,
  onChange,
}: {
  schools: School[];
  onChange: (next: School[]) => void;
}) {
  function set(i: number, patch: Partial<School>) {
    const next = schools.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function remove(i: number) {
    const next = schools.slice();
    next.splice(i, 1);
    onChange(next);
  }
  function move(i: number, dir: -1 | 1) {
    const next = schools.slice();
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function add() {
    onChange([...schools, { name: "", degree: "" }]);
  }
  return (
    <div className="structured__list">
      {schools.map((s, i) => (
        <div className="structured__row structured__row--group" key={i}>
          <input
            value={s.name}
            onChange={(e) => set(i, { name: e.target.value })}
            placeholder="School"
          />
          <input
            value={s.degree}
            onChange={(e) => set(i, { degree: e.target.value })}
            placeholder="Degree"
          />
          <RowActions
            onUp={() => move(i, -1)}
            onDown={() => move(i, 1)}
            onRemove={() => remove(i)}
            upDisabled={i === 0}
            downDisabled={i === schools.length - 1}
          />
        </div>
      ))}
      <button type="button" className="structured__add-row" onClick={add}>
        + Add school
      </button>
    </div>
  );
}

function RowActions({
  onUp,
  onDown,
  onRemove,
  upDisabled,
  downDisabled,
}: {
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  upDisabled: boolean;
  downDisabled: boolean;
}) {
  return (
    <div className="structured__row-actions">
      <button type="button" onClick={onUp} disabled={upDisabled} title="Move up">
        ↑
      </button>
      <button type="button" onClick={onDown} disabled={downDisabled} title="Move down">
        ↓
      </button>
      <button type="button" onClick={onRemove} title="Remove">
        ✕
      </button>
    </div>
  );
}
