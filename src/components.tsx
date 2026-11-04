import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  SUBJECTS,
  STATUSES,
  uid,
  resourceUrl,
  driveFileId,
  validatePlan,
  isTeachingDay,
  formatDate,
  removeCurriculum,
} from './model'
import type {
  Plan,
  Lesson,
  Calendar,
  Resource,
  Subject,
  CurriculumTarget,
} from './model'

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className={wide ? 'modal wide' : 'modal'}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      aria-labelledby="dialog-title"
    >
      <div className="modal-head">
        <div>
          <p className="eyebrow">YOUR PLANNING SPACE</p>
          <h2 id="dialog-title">{title}</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  )
}

export function LessonEditor({
  lesson,
  plan,
  onSave,
  onDelete,
  onClose,
}: {
  lesson: Lesson
  plan: Plan
  onSave: (lesson: Lesson) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Lesson>(() => structuredClone(lesson))
  const [error, setError] = useState('')
  const update = (patch: Partial<Lesson>) => setDraft({ ...draft, ...patch })
  const changeResource = (id: string, patch: Partial<Resource>) =>
    update({
      resources: draft.resources.map((r) =>
        r.id === id ? { ...r, ...patch } : r,
      ),
    })
  return (
    <Modal
      title={
        plan.lessons.some((l) => l.id === lesson.id)
          ? 'Inside your planning card'
          : 'A new planning card'
      }
      onClose={onClose}
      wide
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.title.trim())
            return setError('Give your planning card a title.')
          if (draft.date && !isTeachingDay(draft.date, plan.calendar))
            return setError(
              'Choose a teaching day within your term, or clear the date to leave it unscheduled.',
            )
          if (draft.resources.some((r) => !r.title.trim() || !resourceUrl(r)))
            return setError(
              'Each resource needs a title and a valid http or https link.',
            )
          onSave({ ...draft, title: draft.title.trim() })
        }}
      >
        <label>
          Lesson title
          <input
            autoFocus
            required
            maxLength={160}
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="What will your learners explore?"
          />
        </label>
        <div className="form-grid">
          <label>
            Subject
            <select
              value={draft.subject}
              onChange={(e) => update({ subject: e.target.value as Subject })}
            >
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Learning stage
            <select
              value={draft.status}
              onChange={(e) =>
                update({ status: e.target.value as Lesson['status'] })
              }
            >
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label>
            Teaching date <span className="optional">optional</span>
            <input
              type="date"
              min={plan.calendar.start}
              max={plan.calendar.end}
              value={draft.date}
              onChange={(e) => update({ date: e.target.value })}
            />
          </label>
          <label>
            Instructional periods
            <input
              type="number"
              min="1"
              max="12"
              required
              value={draft.periods}
              onChange={(e) => update({ periods: Number(e.target.value) })}
            />
            <small>
              {draft.periods * plan.calendar.periodMinutes} minutes at your
              current timetable settings
            </small>
          </label>
        </div>
        <fieldset>
          <legend>Connected outcomes</legend>
          <p className="field-help">
            One card can support several outcomes. Changes appear everywhere.
          </p>
          <div className="outcome-choices">
            {plan.outcomes.map((o) => (
              <label className="check-row" key={o.id}>
                <input
                  type="checkbox"
                  checked={draft.outcomeIds.includes(o.id)}
                  onChange={(e) =>
                    update({
                      outcomeIds: e.target.checked
                        ? [...draft.outcomeIds, o.id]
                        : draft.outcomeIds.filter((id) => id !== o.id),
                    })
                  }
                />
                <span>
                  {o.title}
                  <small>
                    {plan.units.find((u) => u.id === o.unitId)?.title}
                  </small>
                </span>
              </label>
            ))}
            {!plan.outcomes.length && (
              <p>Add an outcome from the tabletop to connect it here.</p>
            )}
          </div>
        </fieldset>
        <label>
          Lesson notes
          <textarea
            rows={4}
            value={draft.notes}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="The invitation, the investigation, the conversation…"
          />
        </label>
        <label>
          Assessment · what will you look for?
          <textarea
            rows={2}
            value={draft.assessment}
            onChange={(e) => update({ assessment: e.target.value })}
            placeholder="What will help you notice learning?"
          />
        </label>
        <fieldset>
          <legend>Resources, right where they live</legend>
          <p className="field-help">
            Paste a link to an existing file. Four Square saves the link and
            your page or slide notes; it never moves or edits the original. No
            Google connection is required.
          </p>
          {draft.resources.map((r, i) => (
            <div className="resource-edit" key={r.id}>
              <div className="section-title">
                <strong>Resource {i + 1}</strong>
                <button
                  type="button"
                  className="text-button danger"
                  onClick={() =>
                    update({
                      resources: draft.resources.filter((x) => x.id !== r.id),
                    })
                  }
                >
                  Remove
                </button>
              </div>
              <label>
                Resource name
                <input
                  required
                  value={r.title}
                  onChange={(e) =>
                    changeResource(r.id, { title: e.target.value })
                  }
                />
              </label>
              <label>
                Original file link
                <input
                  type="url"
                  required
                  value={r.url}
                  placeholder="https://drive.google.com/file/d/…"
                  onChange={(e) =>
                    changeResource(r.id, { url: e.target.value })
                  }
                />
              </label>
              <div className="form-grid">
                <label>
                  Type
                  <select
                    value={r.kind}
                    onChange={(e) =>
                      changeResource(r.id, {
                        kind: e.target.value as Resource['kind'],
                      })
                    }
                  >
                    {['PDF', 'Slides', 'Link'].map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Pages or slides <span className="optional">notes only</span>
                  <input
                    value={r.selection}
                    placeholder="e.g. pages 14–16"
                    onChange={(e) =>
                      changeResource(r.id, { selection: e.target.value })
                    }
                  />
                </label>
              </div>
              {driveFileId(r.url) && (
                <small>
                  Google file reference recognized · original stays in your
                  Drive
                </small>
              )}
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            onClick={() =>
              update({
                resources: [
                  ...draft.resources,
                  {
                    id: uid(),
                    title: '',
                    url: '',
                    kind: 'Link',
                    selection: '',
                  },
                ],
              })
            }
          >
            ＋ Add resource link
          </button>
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {plan.lessons.some((l) => l.id === lesson.id) && (
            <button
              type="button"
              className="text-button danger"
              onClick={() => {
                if (
                  confirm(
                    'Delete this planning card from every view and linked outcome?',
                  )
                )
                  onDelete()
              }}
            >
              Delete card
            </button>
          )}
          <div className="action-group">
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="primary" type="submit">
              Save planning card
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export function CalendarEditor({
  plan,
  onSave,
  onClose,
}: {
  plan: Plan
  onSave: (calendar: Calendar) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Calendar>(() =>
    structuredClone(plan.calendar),
  )
  const [error, setError] = useState('')
  const [date, setDate] = useState('')
  const [label, setLabel] = useState('')
  const displaced = plan.lessons.filter(
    (l) => l.date && !isTeachingDay(l.date, draft),
  ).length
  return (
    <Modal title="Make room for real teaching" onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          try {
            validatePlan({ ...plan, calendar: draft })
            onSave(draft)
          } catch {
            setError(
              'Check the term dates (up to two years), period length, and timetable values.',
            )
          }
        }}
      >
        <p className="field-help">
          Set your term, weekly timetable, and days away. This is your calendar;
          sample dates are not an official district calendar.
        </p>
        <div className="form-grid">
          <label>
            Term starts
            <input
              required
              type="date"
              value={draft.start}
              onChange={(e) => setDraft({ ...draft, start: e.target.value })}
            />
          </label>
          <label>
            Term ends
            <input
              required
              type="date"
              min={draft.start}
              value={draft.end}
              onChange={(e) => setDraft({ ...draft, end: e.target.value })}
            />
          </label>
        </div>
        <label>
          Minutes in one period
          <input
            type="number"
            min="1"
            max="180"
            required
            value={draft.periodMinutes}
            onChange={(e) =>
              setDraft({ ...draft, periodMinutes: Number(e.target.value) })
            }
          />
        </label>
        <fieldset>
          <legend>Your weekly timetable</legend>
          <p className="field-help">
            Instructional periods per subject, per day. Set 0 for days you don't
            teach a subject.
          </p>
          <div className="table-scroll">
            <table className="timetable">
              <thead>
                <tr>
                  <th>Subject</th>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => (
                    <th key={d}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SUBJECTS.map((s) => (
                  <tr key={s}>
                    <th>{s}</th>
                    {draft.timetable[s].map((n, i) => (
                      <td key={i}>
                        <input
                          aria-label={`${s} ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][i]} periods`}
                          type="number"
                          min="0"
                          max="12"
                          required
                          value={n}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              timetable: {
                                ...draft.timetable,
                                [s]: draft.timetable[s].map((v, j) =>
                                  j === i ? Number(e.target.value) : v,
                                ),
                              },
                            })
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
        <fieldset>
          <legend>Holidays, PD days & time away</legend>
          <div className="exclusions">
            {draft.exclusions.map((e) => (
              <div key={e.date}>
                <span>
                  <strong>{formatDate(e.date)}</strong> {e.label}
                </span>
                <button
                  type="button"
                  className="text-button danger"
                  aria-label={`Remove ${e.label} on ${e.date}`}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      exclusions: draft.exclusions.filter(
                        (x) => x.date !== e.date,
                      ),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="form-grid">
            <label>
              Day away
              <input
                type="date"
                value={date}
                min={draft.start}
                max={draft.end}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>
              Reason
              <input
                value={label}
                placeholder="e.g. Professional learning"
                maxLength={100}
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            className="secondary"
            disabled={
              !date || !label.trim() || date < draft.start || date > draft.end
            }
            onClick={() => {
              setDraft({
                ...draft,
                exclusions: [
                  ...draft.exclusions.filter((e) => e.date !== date),
                  { date, label: label.trim() },
                ].sort((a, b) => a.date.localeCompare(b.date)),
              })
              setDate('')
              setLabel('')
            }}
          >
            ＋ Add day away
          </button>
        </fieldset>
        {displaced > 0 && (
          <p className="notice">
            {displaced} scheduled card{displaced === 1 ? '' : 's'} fall outside
            these teaching days. They will be kept and flagged so you can
            reschedule them.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <span className="field-help">
            Existing cards are never moved automatically.
          </span>
          <div className="action-group">
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary">
              Save calendar
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export function CurriculumEditor({
  plan,
  unitId,
  target,
  onSave,
  onClose,
}: {
  plan: Plan
  unitId?: string
  target?: CurriculumTarget
  onSave: (plan: Plan) => void
  onClose: () => void
}) {
  const existingUnit =
    target?.kind === 'unit'
      ? plan.units.find((u) => u.id === target.id)
      : undefined
  const existingOutcome =
    target?.kind === 'outcome'
      ? plan.outcomes.find((o) => o.id === target.id)
      : undefined
  const [kind, setKind] = useState<'unit' | 'outcome'>(
    target?.kind ?? (unitId ? 'outcome' : 'unit'),
  )
  const [parent, setParent] = useState(
    existingOutcome?.unitId ?? unitId ?? plan.units[0]?.id ?? '',
  )
  const [title, setTitle] = useState(
    existingUnit?.title ?? existingOutcome?.title ?? '',
  )
  const [description, setDescription] = useState(
    existingOutcome?.description ?? '',
  )
  const [subject, setSubject] = useState<Subject>(
    existingUnit?.subject ?? 'Science',
  )
  return (
    <Modal
      title={target ? 'Make this curriculum your own' : 'Grow your curriculum'}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim()) return
          const id = target?.id ?? uid()
          if (target) {
            onSave(
              kind === 'unit'
                ? {
                    ...plan,
                    units: plan.units.map((u) =>
                      u.id === id ? { id, title: title.trim(), subject } : u,
                    ),
                  }
                : {
                    ...plan,
                    outcomes: plan.outcomes.map((o) =>
                      o.id === id
                        ? {
                            id,
                            title: title.trim(),
                            description,
                            unitId: parent,
                          }
                        : o,
                    ),
                  },
            )
            return
          }
          onSave(
            kind === 'unit'
              ? {
                  ...plan,
                  units: [...plan.units, { id, title: title.trim(), subject }],
                }
              : {
                  ...plan,
                  outcomes: [
                    ...plan.outcomes,
                    { id, title: title.trim(), description, unitId: parent },
                  ],
                },
          )
        }}
      >
        <label>
          Add a
          <select
            disabled={!!target}
            value={kind}
            onChange={(e) => setKind(e.target.value as 'unit' | 'outcome')}
          >
            <option value="unit">Unit</option>
            <option value="outcome" disabled={!plan.units.length}>
              Curriculum outcome
            </option>
          </select>
        </label>
        {kind === 'unit' ? (
          <label>
            Subject
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value as Subject)}
            >
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            Belongs to unit
            <select
              required
              value={parent}
              onChange={(e) => setParent(e.target.value)}
            >
              {plan.units.map((u) => (
                <option value={u.id} key={u.id}>
                  {u.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {kind === 'unit' ? 'Unit name' : 'Outcome title'}
          <input
            autoFocus
            maxLength={160}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        {kind === 'outcome' && (
          <label>
            Outcome wording
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste the curriculum wording you are planning from."
            />
          </label>
        )}
        <div className="modal-actions">
          {target ? (
            <button
              type="button"
              className="text-button danger"
              onClick={() => {
                if (
                  confirm(
                    `Delete this ${kind}${kind === 'unit' ? ' and its outcomes' : ''}? Planning cards will be kept; these outcome connections will be removed.`,
                  )
                )
                  onSave(removeCurriculum(plan, target))
              }}
            >
              Delete {kind}
            </button>
          ) : (
            <span />
          )}
          <div className="action-group">
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary">
              {target ? 'Save' : 'Add'} {kind}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
