import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { getErrorMessage } from '../../../../Hooks/useAsyncRequest';
import { useVisibleInterval } from '../../../../Hooks/useVisibleInterval';
import { MASKED } from '../../../../Hooks/Companies/useCompanyData';
import {
  leadsApi,
  useLeadDetail,
  type Lead_Card,
  type Lead_Comment,
  type Lead_Outcome,
  type Lead_Person,
  type Lead_Source_Column,
  type Lead_Stage,
} from '../../../../Hooks/Companies/useCompanyLeads';
import { Clock, Close, Edit, Phone, Trash } from '../../../../Imports/icons';
import { localeOf } from '../../../../utils/locale';
import { formatCell } from './dataHelpers';
import { callbackState, cardTitle, dayKey, dayLabel, fromLocalInput, initialsOf, relativeTime, suggestCallback, toLocalInput } from './leadHelpers';

interface Lead_Sidebar_Props {
  companyId: string;
  boardId: string;
  card: Lead_Card;
  stages: Lead_Stage[];
  outcomes: Lead_Outcome[];
  people: Lead_Person[];
  // A posição no fim de cada coluna (para «Coluna»)
  endOf: (stageId: string) => number;
  titleColumn: string | null;
  phoneColumn: string | null;
  canWork: boolean;
  onChanged: () => void;
  onClose: () => void;
}

const MAX_COMMENT = 4000;
// A lead aberta volta a pedir-se como o quadro (a encomenda pode mudar entretanto)
const POLL_MS = 30_000;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Um comentário, como numa conversa: o círculo com as iniciais, quem e há quanto tempo (a hora exata ao passar o
 * rato), o texto. O próprio muda-o ou apaga-o pelos botões que aparecem ao passar (apagar pergunta antes).
 */
const Comment_Item = ({
  comment,
  canWork,
  now,
  onEdit,
  onDelete,
}: {
  comment: Lead_Comment;
  canWork: boolean;
  now: Date;
  onEdit: (body: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) => {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState(comment.body);
  const [busy, setBusy] = useState(false);
  const mine = comment.mine && canWork;
  const exact = new Date(comment.createdAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

  const save = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await onEdit(text.trim());
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`Leads_Comment${comment.mine ? ' Mine' : ''}`}>
      <span className="Leads_Avatar" aria-hidden="true">{initialsOf(comment.userName)}</span>
      <div className="Leads_Comment_Main">
        <div className="Leads_Comment_Head">
          <span className="Leads_Comment_Author">{comment.userName ?? t('callCenter.leadsSomeone')}</span>
          <time className="Leads_Comment_Time" dateTime={comment.createdAt} title={exact}>
            {relativeTime(comment.createdAt, now, locale)}
          </time>
          {comment.editedAt && <span className="Leads_Comment_Time">· {t('callCenter.leadsEdited')}</span>}
          {mine && !editing && !confirming && (
            <span className="Leads_Comment_Tools">
              <button type="button" className="Leads_Comment_Tool" aria-label={t('callCenter.leadsCommentEdit')} title={t('callCenter.leadsCommentEdit')} onClick={() => setEditing(true)}>
                <Edit />
              </button>
              <button type="button" className="Leads_Comment_Tool" aria-label={t('callCenter.leadsCommentDelete')} title={t('callCenter.leadsCommentDelete')} onClick={() => setConfirming(true)}>
                <Trash />
              </button>
            </span>
          )}
        </div>
        {editing ? (
          <div className="Leads_Comment_Edit">
            <textarea
              className="Leads_Textarea"
              value={text}
              maxLength={MAX_COMMENT}
              rows={3}
              aria-label={t('callCenter.leadsCommentEdit')}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  save();
                }
              }}
            />
            <div className="Leads_Comment_Confirm">
              <button type="button" className="Call_Center_Text_Button" onClick={() => { setText(comment.body); setEditing(false); }}>
                {t('common.cancel')}
              </button>
              <Simple_Button text={t('common.save')} small auto disabled={!text.trim() || text.trim() === comment.body || busy} onClick={save} />
            </div>
          </div>
        ) : (
          <p className="Leads_Comment_Body">{comment.body}</p>
        )}
        {confirming && (
          <div className="Leads_Comment_Confirm" role="group" aria-label={t('callCenter.leadsCommentDelete')}>
            <span className="Call_Center_Sub">{t('callCenter.leadsCommentDeleteAsk')}</span>
            <button type="button" className="Call_Center_Text_Button" onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="Call_Center_Text_Button Leads_Danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onDelete();
                } finally {
                  setBusy(false);
                  setConfirming(false);
                }
              }}
            >
              {t('common.delete')}
            </button>
          </div>
        )}
      </div>
    </li>
  );
};

const isEmptyValue = (value: string | number | null | undefined) => value === null || value === undefined || value === '';

/**
 * Os dados da linha como uma ficha: o rótulo à esquerda e o valor à direita, uma linha por campo; numa tabela unida,
 * separados por lado (o título fica preso em cima ao descer). Os vazios escondem-se até se pedirem e há uma pesquisa
 * pelo rótulo ou pelo valor. Só a lista faz scroll.
 */
const Row_Fields = ({ columns, values }: { columns: Lead_Source_Column[]; values: Record<string, string | number | null> }) => {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const [query, setQuery] = useState('');
  const [showEmpty, setShowEmpty] = useState(false);
  const needle = query.trim().toLocaleLowerCase(locale);
  const emptyCount = columns.filter((column) => isEmptyValue(values[column.key])).length;

  const groups = (columns.some((column) => column.side)
    ? (['left', 'right'] as const).map((side) => ({ side, columns: columns.filter((column) => column.side === side) }))
    : [{ side: null, columns }]
  )
    .map((group) => ({
      ...group,
      rows: group.columns
        .map((column) => ({ column, value: values[column.key], text: formatCell(values[column.key], column.type, locale) }))
        .filter(({ column, value, text }) => {
          if (needle) return column.label.toLocaleLowerCase(locale).includes(needle) || (value !== MASKED && String(text).toLocaleLowerCase(locale).includes(needle));
          return showEmpty || !isEmptyValue(value);
        }),
    }))
    .filter((group) => group.rows.length);

  return (
    <>
      <div className="Leads_Pane_Tools">
        <input
          type="search"
          className="Leads_Search"
          value={query}
          placeholder={t('callCenter.leadsFieldSearch')}
          aria-label={t('callCenter.leadsFieldSearch')}
          onChange={(event) => setQuery(event.target.value)}
        />
        {emptyCount > 0 && !needle && (
          <button type="button" className="Call_Center_Text_Button" aria-pressed={showEmpty} onClick={() => setShowEmpty((value) => !value)}>
            {showEmpty ? t('callCenter.leadsHideEmpty') : t('callCenter.leadsShowEmpty', { count: emptyCount })}
          </button>
        )}
      </div>
      <div className="Leads_Pane_Scroll Leads_Props_Scroll">
        {groups.length === 0 && <span className="Leads_Empty_Note">{t('callCenter.leadsFieldNone', { query: query.trim() })}</span>}
        {groups.map((group) => (
          <section key={group.side ?? 'all'} className="Leads_Props_Group">
            {group.side && (
              <h4 className="Leads_Props_Side">
                {t(group.side === 'left' ? 'callCenter.leadsSideA' : 'callCenter.leadsSideB')}
                <span className="Leads_Count">{group.rows.length}</span>
              </h4>
            )}
            <dl className="Leads_Props">
              {group.rows.map(({ column, value, text }) => (
                <div key={column.key} className="Leads_Prop">
                  <dt title={column.label}>{column.label}</dt>
                  <dd className={value === MASKED ? 'Masked' : isEmptyValue(value) ? 'Empty' : undefined}>{text}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </>
  );
};

type Drawer_Tab = 'comments' | 'data' | 'history';
const NOBODY = '__none';
// A gaveta larga mostra os dados ao lado; estreita, são outro separador
const WIDE_DRAWER = 820;

/**
 * A lead aberta: uma gaveta que sai da direita do ecrã (até meio, a altura toda, com o scroll dela), com o
 * telefone, a coluna em que está (mudar daqui é o mesmo que arrastar), os comentários, os dados da linha e o
 * histórico. Fecha no ×, no Esc ou num clique fora.
 */
/**
 * Registar uma chamada: o resultado já escolhido, um comentário opcional e (se o resultado o pede, ou se se quiser)
 * a hora de voltar a ligar. Grava tudo de uma vez.
 */
const Call_Form = ({
  outcome,
  busy,
  onSave,
  onCancel,
}: {
  outcome: Lead_Outcome;
  busy: boolean;
  onSave: (body: { comment: string; callbackAt: string | null; callbackNote: string }) => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslation();
  const [comment, setComment] = useState('');
  const [withCallback, setWithCallback] = useState(outcome.asksCallback);
  const [at, setAt] = useState(() => toLocalInput(suggestCallback(new Date())));
  const [note, setNote] = useState('');
  const callbackAt = withCallback ? fromLocalInput(at) : null;

  return (
    <form
      className="Leads_Call_Form"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || (withCallback && !callbackAt)) return;
        onSave({ comment, callbackAt, callbackNote: note });
      }}
    >
      <span className="Call_Center_Strong">{t('callCenter.leadsCallLog', { outcome: outcome.name })}</span>
      <label htmlFor="lead-call-comment" className="Leads_Visually_Hidden">{t('callCenter.leadsCommentLabel')}</label>
      <textarea
        id="lead-call-comment"
        className="Leads_Textarea"
        rows={2}
        maxLength={MAX_COMMENT}
        value={comment}
        placeholder={t('callCenter.leadsCallCommentPlaceholder')}
        onChange={(event) => setComment(event.target.value)}
      />
      <label className="Call_Center_Check">
        <input type="checkbox" checked={withCallback} onChange={(event) => setWithCallback(event.target.checked)} />
        <span>{t('callCenter.leadsCallbackSet')}</span>
      </label>
      {withCallback && (
        <div className="Leads_Callback_Fields">
          <label htmlFor="lead-call-at" className="Leads_Visually_Hidden">{t('callCenter.leadsCallbackWhen')}</label>
          <input id="lead-call-at" type="datetime-local" className="Leads_Search" value={at} onChange={(event) => setAt(event.target.value)} />
          <label htmlFor="lead-call-note" className="Leads_Visually_Hidden">{t('callCenter.leadsCallbackNote')}</label>
          <input
            id="lead-call-note"
            className="Leads_Search"
            maxLength={300}
            value={note}
            placeholder={t('callCenter.leadsCallbackNotePlaceholder')}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      )}
      <div className="Leads_Comment_Confirm">
        <button type="button" className="Call_Center_Text_Button" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <Simple_Button text={t('callCenter.leadsCallSave')} type="submit" small auto disabled={busy || (withCallback && !callbackAt)} />
      </div>
    </form>
  );
};

/** Marcar (ou mudar) quando se volta a ligar, sem registar uma chamada. */
const Callback_Form = ({
  initial,
  initialNote,
  busy,
  onSave,
  onCancel,
}: {
  initial: string | null;
  initialNote: string | null;
  busy: boolean;
  onSave: (callbackAt: string, note: string) => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslation();
  const [at, setAt] = useState(() => toLocalInput(initial ? new Date(initial) : suggestCallback(new Date())));
  const [note, setNote] = useState(initialNote ?? '');
  const callbackAt = fromLocalInput(at);
  return (
    <form
      className="Leads_Call_Form"
      onSubmit={(event) => {
        event.preventDefault();
        if (callbackAt && !busy) onSave(callbackAt, note);
      }}
    >
      <div className="Leads_Callback_Fields">
        <label htmlFor="lead-callback-at" className="Leads_Visually_Hidden">{t('callCenter.leadsCallbackWhen')}</label>
        <input id="lead-callback-at" type="datetime-local" className="Leads_Search" value={at} onChange={(event) => setAt(event.target.value)} />
        <label htmlFor="lead-callback-note" className="Leads_Visually_Hidden">{t('callCenter.leadsCallbackNote')}</label>
        <input
          id="lead-callback-note"
          className="Leads_Search"
          maxLength={300}
          value={note}
          placeholder={t('callCenter.leadsCallbackNotePlaceholder')}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <div className="Leads_Comment_Confirm">
        <button type="button" className="Call_Center_Text_Button" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <Simple_Button text={t('common.save')} type="submit" small auto disabled={!callbackAt || busy} />
      </div>
    </form>
  );
};

const Lead_Sidebar = ({ companyId, boardId, card, stages, outcomes, people, endOf, titleColumn, phoneColumn, canWork, onChanged, onClose }: Lead_Sidebar_Props) => {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const { data, error, reload } = useLeadDetail(companyId, boardId, card.rowKey);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const seenComments = useRef(-1);
  const closeRef = useRef(onClose);
  const [tab, setTab] = useState<Drawer_Tab>('comments');
  const [calling, setCalling] = useState<Lead_Outcome | null>(null);
  const [editingCallback, setEditingCallback] = useState(false);
  const [wide, setWide] = useState(false);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    const observer = new ResizeObserver(([entry]) => setWide(entry.contentRect.width >= WIDE_DRAWER));
    observer.observe(drawer);
    return () => observer.disconnect();
  }, []);

  const activeTab: Drawer_Tab = wide && tab === 'data' ? 'comments' : tab;
  const commentCount = data?.comments.length ?? 0;

  // A conversa abre no fim (o mais recente) e desce quando chega um comentário novo; o polling não mexe no scroll
  useEffect(() => {
    if (activeTab !== 'comments') {
      seenComments.current = -1;
      return;
    }
    if (!data) return;
    const thread = threadRef.current;
    if (thread && commentCount > seenComments.current) thread.scrollTop = thread.scrollHeight;
    seenComments.current = commentCount;
  }, [data, commentCount, activeTab]);

  const [now, setNow] = useState(() => new Date());
  useVisibleInterval(() => {
    reload();
    setNow(new Date());
  }, POLL_MS);

  // Ao abrir: o foco entra na gaveta e a página por trás não se mexe; ao fechar, o foco volta ao cartão
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    drawerRef.current?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      reload();
      setNow(new Date());
      onChanged();
      return true;
    } catch (reason) {
      setActionError(getErrorMessage(reason));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const body = comment.trim();
    if (!body || busy) return;
    if (await run(() => leadsApi.addComment(companyId, boardId, { rowKey: card.rowKey, body, position: card.position }))) setComment('');
  };

  const onCommentKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter (ou ⌘+Enter) envia; o Enter sozinho muda de linha
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      send();
    }
  };

  // O Esc fecha (menos com uma lista aberta) e o Tab dá a volta dentro da gaveta
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      if (event.defaultPrevented || document.querySelector('.Dropdown_Field_Panel')) return;
      event.preventDefault();
      closeRef.current();
      return;
    }
    if (event.key !== 'Tab' || !drawerRef.current) return;
    const items = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === drawerRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const values = data?.values ?? card.values;
  const phone = phoneColumn ? values[phoneColumn] : null;
  const phoneText = phone === null || phone === undefined ? '' : String(phone);
  const callable = phoneText && phoneText !== MASKED;
  const title = cardTitle(card, titleColumn, values);
  const stage = stages.find((s) => s.id === card.stageId);
  const dataPane = (
    <>
      {error && !data && <span className="Call_Center_Message Bad Leads_Pane_Note">{error}</span>}
      {!data && !error && <span className="Call_Center_Sub Leads_Pane_Note">{t('common.loading')}</span>}
      {data && <Row_Fields columns={data.columns} values={data.values} />}
    </>
  );

  return createPortal(
    <div
      className="Leads_Drawer_Backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeRef.current();
      }}
    >
      <aside
        ref={drawerRef}
        className="Leads_Drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-drawer-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="Leads_Drawer_Head">
          <div className="Leads_Drawer_Title">
            <h2 id="lead-drawer-title">{title}</h2>
            <span className="Leads_Drawer_Sub">
              {stage && <span className="Call_Center_Sub">{t('callCenter.leadsOpenAt', { stage: stage.name })}</span>}
              {card.byRule && <span className="Leads_Badge Rule">{t('callCenter.leadsByRule', { rule: card.byRule })}</span>}
              {card.outOfFilter && !card.byRule && (
                <span className="Leads_Badge">{t(card.missing ? 'callCenter.leadsMissing' : 'callCenter.leadsOutOfFilter')}</span>
              )}
              {card.archived && <span className="Leads_Badge">{t('callCenter.leadsArchivedBadge')}</span>}
            </span>
          </div>
          <button type="button" className="Leads_Drawer_Close" onClick={() => closeRef.current()} aria-label={t('callCenter.leadsClose')} title={t('callCenter.leadsClose')}>
            <Close />
          </button>
        </header>

        <div className="Leads_Drawer_Bar">
          <div className="Leads_Drawer_Row">
          {phoneColumn && (
            <div className="Leads_Phone">
              <span className="Leads_Phone_Icon"><Phone /></span>
              {callable ? (
                <a href={`tel:${phoneText.replace(/[^\d+]/g, '')}`} className="Leads_Phone_Link">
                  {phoneText}
                </a>
              ) : (
                <span className="Call_Center_Sub">{phoneText || t('callCenter.leadsNoPhone')}</span>
              )}
            </div>
          )}
          {canWork && (
            <div className="Leads_Drawer_Actions">
              <div className="Form_Field">
                <label htmlFor="lead-assignee">{t('callCenter.leadsAssignee')}</label>
                <Global_Dropdown
                  id="lead-assignee"
                  value={card.assignedToId ?? NOBODY}
                  disabled={busy}
                  onChange={(next) => {
                    const assignedToId = next === NOBODY ? null : String(next);
                    if (assignedToId === card.assignedToId) return;
                    run(() => leadsApi.assign(companyId, boardId, { rowKey: card.rowKey, assignedToId, position: card.position }));
                  }}
                  options={[{ value: NOBODY, label: t('callCenter.leadsNobody') }, ...people.map((p) => ({ value: p.id, label: p.name }))]}
                />
              </div>
              <div className="Form_Field">
                <label htmlFor="lead-move-stage">{t('callCenter.leadsMoveTo')}</label>
                <Global_Dropdown
                  id="lead-move-stage"
                  value={card.stageId}
                  disabled={busy || card.archived}
                  onChange={(next) => {
                    const stageId = String(next);
                    if (stageId === card.stageId) return;
                    run(() => leadsApi.move(companyId, boardId, { rowKey: card.rowKey, stageId, position: endOf(stageId), from: card.position }));
                  }}
                  options={stages.map((s) => ({ value: s.id, label: s.name }))}
                />
              </div>
              <Simple_Button
                text={card.archived ? t('callCenter.leadsRestore') : t('callCenter.leadsArchive')}
                variant="Ghost"
                small
                auto
                disabled={busy}
                onClick={() => run(() => leadsApi.archive(companyId, boardId, { rowKey: card.rowKey, archived: !card.archived, position: card.position }))}
              />
            </div>
          )}
          </div>

          {canWork && !card.archived && outcomes.length > 0 && !calling && (
            <div className="Leads_Outcomes" role="group" aria-label={t('callCenter.leadsCallTitle')}>
              <span className="Leads_Outcomes_Label">{t('callCenter.leadsCallTitle')}</span>
              {outcomes.map((outcome) => (
                <button
                  key={outcome.id}
                  type="button"
                  className={`Leads_Outcome${outcome.answered ? ' Answered' : ''}`}
                  disabled={busy}
                  onClick={() => {
                    setEditingCallback(false);
                    setCalling(outcome);
                  }}
                >
                  {outcome.name}
                </button>
              ))}
            </div>
          )}
          {calling && (
            <Call_Form
              outcome={calling}
              busy={busy}
              onCancel={() => setCalling(null)}
              onSave={async (body) => {
                const ok = await run(() =>
                  leadsApi.logCall(companyId, boardId, {
                    rowKey: card.rowKey,
                    outcomeId: calling.id,
                    comment: body.comment.trim() || null,
                    callbackAt: body.callbackAt,
                    callbackNote: body.callbackNote.trim() || null,
                    position: card.position,
                  }),
                );
                if (ok) setCalling(null);
              }}
            />
          )}

          <div className="Leads_Call_Info">
            {card.callbackAt && !editingCallback ? (
              <span className={`Leads_Callback ${callbackState(card.callbackAt, now)}`}>
                <Clock />
                {t(callbackState(card.callbackAt, now) === 'overdue' ? 'callCenter.leadsCallbackLate' : 'callCenter.leadsCallbackAt', {
                  time: new Date(card.callbackAt).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
                })}
                {card.callbackNote && <span className="Leads_Callback_Note">· {card.callbackNote}</span>}
              </span>
            ) : null}
            {canWork && !editingCallback && !calling && (
              <span className="Leads_Call_Info_Tools">
                <button type="button" className="Call_Center_Text_Button" onClick={() => setEditingCallback(true)}>
                  {card.callbackAt ? t('callCenter.leadsCallbackChange') : t('callCenter.leadsCallbackSet')}
                </button>
                {card.callbackAt && (
                  <button
                    type="button"
                    className="Call_Center_Text_Button"
                    disabled={busy}
                    onClick={() => run(() => leadsApi.callback(companyId, boardId, { rowKey: card.rowKey, callbackAt: null, position: card.position }))}
                  >
                    {t('callCenter.leadsCallbackClear')}
                  </button>
                )}
              </span>
            )}
            {(card.attempts > 0 || card.lastOutcome) && (
              <span className="Call_Center_Sub">
                {t('callCenter.leadsAttempts', { count: card.attempts })}
                {card.lastOutcome && ` · ${t('callCenter.leadsLastOutcome', { outcome: card.lastOutcome })}`}
              </span>
            )}
          </div>
          {editingCallback && (
            <Callback_Form
              initial={card.callbackAt}
              initialNote={card.callbackNote}
              busy={busy}
              onCancel={() => setEditingCallback(false)}
              onSave={async (callbackAt, note) => {
                const ok = await run(() => leadsApi.callback(companyId, boardId, { rowKey: card.rowKey, callbackAt, note: note.trim() || null, position: card.position }));
                if (ok) setEditingCallback(false);
              }}
            />
          )}
        </div>
        {actionError && <span className="Call_Center_Message Bad Leads_Drawer_Error">{actionError}</span>}

        <div className={`Leads_Drawer_Body${wide ? ' Wide' : ''}`}>
          <div className="Leads_Pane">
            <div className="Leads_Pane_Head">
              <div className="Tabs" role="tablist" aria-label={t('callCenter.leadsTabs')}>
                {(wide ? (['comments', 'history'] as const) : (['comments', 'data', 'history'] as const)).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="tab"
                    id={`lead-tab-${option}`}
                    aria-controls="lead-tab-panel"
                    aria-selected={activeTab === option}
                    className={activeTab === option ? 'Active' : ''}
                    onClick={() => setTab(option)}
                  >
                    {t(option === 'comments' ? 'callCenter.leadsCommentsTitle' : option === 'data' ? 'callCenter.leadsData' : 'callCenter.leadsHistory')}
                    {option === 'comments' && <span className="Leads_Tab_Count">{data?.comments.length ?? card.comments}</span>}
                    {option === 'history' && data && data.events.length > 0 && <span className="Leads_Tab_Count">{data.events.length}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div id="lead-tab-panel" role="tabpanel" aria-labelledby={`lead-tab-${activeTab}`} className="Leads_Pane_Panel">
              {activeTab === 'comments' && (
                <>
                  <div ref={threadRef} className="Leads_Pane_Scroll">
                    {!data && !error && <span className="Call_Center_Sub">{t('common.loading')}</span>}
                    {data && data.comments.length === 0 && <span className="Leads_Empty_Note">{t('callCenter.leadsNoComments')}</span>}
                    {data && data.comments.length > 0 && (
                      <ul className="Leads_Comments">
                        {data.comments.map((item, index, list) => {
                          const newDay = index === 0 || dayKey(list[index - 1].createdAt) !== dayKey(item.createdAt);
                          return (
                            <Fragment key={item.id}>
                              {newDay && (
                                <li className="Leads_Day" aria-hidden="true">
                                  <span>{dayLabel(item.createdAt, now, locale)}</span>
                                </li>
                              )}
                              <Comment_Item
                                comment={item}
                                canWork={canWork}
                                now={now}
                                onEdit={async (body) => {
                                  await run(() => leadsApi.editComment(companyId, boardId, item.id, body));
                                }}
                                onDelete={async () => {
                                  await run(() => leadsApi.deleteComment(companyId, boardId, item.id));
                                }}
                              />
                            </Fragment>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {canWork && (
                    <div className="Leads_Pane_Foot">
                      <div className="Leads_Composer">
                        <label htmlFor="lead-comment" className="Leads_Visually_Hidden">
                          {t('callCenter.leadsCommentLabel')}
                        </label>
                        <textarea
                          id="lead-comment"
                          className="Leads_Composer_Input"
                          value={comment}
                          maxLength={MAX_COMMENT}
                          rows={2}
                          placeholder={t('callCenter.leadsCommentPlaceholder')}
                          onChange={(event) => setComment(event.target.value)}
                          onKeyDown={onCommentKey}
                        />
                        <div className="Leads_Composer_Foot">
                          <span className="Call_Center_Sub">{t('callCenter.leadsCommentHint')}</span>
                          <Simple_Button text={t('callCenter.leadsCommentSend')} small auto disabled={!comment.trim() || busy} onClick={send} />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'history' && (
                <div className="Leads_Pane_Scroll">
                  {data && data.events.length === 0 && <span className="Leads_Empty_Note">{t('callCenter.leadsNoHistory')}</span>}
                  {data && data.events.length > 0 && (
                    <ol className="Leads_History">
                      {data.events.map((event) => (
                        <li key={event.id}>
                          <span className="Leads_History_Dot" aria-hidden="true" />
                          <span className="Leads_History_Text">
                            {event.byRule
                              ? t(`callCenter.leadsEventRule_${event.kind}`, {
                                  rule: event.ruleName ?? t('callCenter.leadsRuleGone'),
                                  from: event.from ?? '—',
                                  to: event.to ?? '—',
                                })
                              : t(`callCenter.leadsEvent_${event.kind}`, {
                                  who: event.userName ?? t('callCenter.leadsSomeone'),
                                  from: event.from ?? '—',
                                  to: event.to ?? '—',
                                  outcome: event.outcome ?? '—',
                                })}
                          </span>
                          <time
                            className="Leads_Comment_Time"
                            dateTime={event.createdAt}
                            title={new Date(event.createdAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}
                          >
                            {relativeTime(event.createdAt, now, locale)}
                          </time>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              {activeTab === 'data' && dataPane}
            </div>
          </div>

          {wide && (
            <section className="Leads_Pane Leads_Pane_Data" aria-labelledby="lead-data-title">
              <div className="Leads_Pane_Head">
                <h3 id="lead-data-title" className="Leads_Section_Title">{t('callCenter.leadsData')}</h3>
              </div>
              <div className="Leads_Pane_Panel">{dataPane}</div>
            </section>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
};

export default Lead_Sidebar;
