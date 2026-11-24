import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent, type PointerEvent as React_Pointer_Event } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import { getErrorMessage } from '../../../../Hooks/useAsyncRequest';
import { useVisibleInterval } from '../../../../Hooks/useVisibleInterval';
import { MASKED, type Data_Row_Filter } from '../../../../Hooks/Companies/useCompanyData';
import {
  leadsApi,
  useLeadBoard,
  type Lead_Board,
  type Lead_Board_Detail,
  type Lead_Bulk_Action,
  type Lead_Card,
  type Lead_Person,
  type Lead_Source_Column,
  type Lead_Stage,
} from '../../../../Hooks/Companies/useCompanyLeads';
import { Check, Chevron_Left, Chevron_Right, Clock, Edit, Phone, Plus, Search, Sliders, Sparkles } from '../../../../Imports/icons';
import { localeOf } from '../../../../utils/locale';
import Data_Anchor_Panel from './Data_Anchor_Panel';
import Lead_Sidebar from './Lead_Sidebar';
import Lead_Rules from './Lead_Rules';
import Lead_Outcomes from './Lead_Outcomes';
import { formatCell } from './dataHelpers';
import { useFitHeight } from './useFitHeight';
import { callbackState, cardTitle, daysInStage, dropIndex, dropPosition, filterCards, initialsOf, type Lead_Quick_Filter } from './leadHelpers';

// Os quadros veem-se de 30 em 30 s (outra pessoa pode estar a mexer), menos a meio de arrastar
const POLL_MS = 30_000;
// No ecrã de toque, arrastar começa ao segurar o cartão (antes disso, mexer o dedo é fazer scroll)
const TOUCH_HOLD_MS = 300;
const TOUCH_SLOP_PX = 10;
const QUICK_FILTERS: Lead_Quick_Filter[] = ['all', 'mine', 'unassigned', 'callbacks', 'stale'];
const STALE_DAYS = [1, 3, 7, 14];

type Placement = { stageId: string; position: number };

/** O texto de um filtro, para o resumo por cima do quadro («Estado é um de In the office»). */
const useFilterText = (columns: Lead_Source_Column[]) => {
  const { t } = useTranslation();
  const byKey = new Map(columns.map((column) => [column.key, column]));
  return (filter: Data_Row_Filter) => {
    const column = byKey.get(filter.column);
    const value =
      filter.op === 'in'
        ? (filter.values ?? []).map((v) => v || t('callCenter.filterValuesEmpty')).join(', ')
        : (filter.value ?? '');
    return `${column?.label ?? filter.column} ${t(`callCenter.filterOp_${filter.op}`)}${value ? ` ${value}` : ''}`;
  };
};

/** O que se faz a uma coluna do quadro (só quem gere): o nome, o limite de cartões, o lugar e apagá-la. */
const Stage_Menu = ({
  stage,
  index,
  total,
  anchor,
  onClose,
  onSave,
  onMove,
  onDelete,
}: {
  stage: Lead_Stage;
  index: number;
  total: number;
  anchor: HTMLElement;
  onClose: () => void;
  onSave: (body: { name?: string; cardLimit?: number | null }) => Promise<void>;
  onMove: (position: number) => Promise<void>;
  onDelete: () => Promise<void>;
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(stage.name);
  const [limit, setLimit] = useState(stage.cardLimit ? String(stage.cardLimit) : '');
  const parsedLimit = limit.trim() ? Math.floor(Number(limit)) : null;
  const limitValid = parsedLimit === null || (Number.isFinite(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 500);
  const changed = (name.trim() && name.trim() !== stage.name) || parsedLimit !== (stage.cardLimit ?? null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!changed || !limitValid || !name.trim()) return;
    onSave({
      ...(name.trim() !== stage.name ? { name: name.trim() } : {}),
      ...(parsedLimit !== (stage.cardLimit ?? null) ? { cardLimit: parsedLimit } : {}),
    });
  };

  return (
    <Data_Anchor_Panel anchor={anchor} onClose={onClose} label={t('callCenter.leadsStageMenu')} className="Leads_Stage_Menu" align="left">
      <form className="Leads_Stage_Form" onSubmit={submit}>
        <label htmlFor="lead-stage-name" className="Call_Center_Panel_Title">{t('callCenter.leadsStageName')}</label>
        <Global_Input id="lead-stage-name" value={name} maxLength={60} autoComplete="off" onChange={(event) => setName(event.target.value)} />
        <label htmlFor="lead-stage-limit" className="Call_Center_Panel_Title">{t('callCenter.leadsStageLimit')}</label>
        <Global_Input
          id="lead-stage-limit"
          type="number"
          min={1}
          max={500}
          value={limit}
          placeholder={t('callCenter.leadsStageLimitNone')}
          onChange={(event) => setLimit(event.target.value)}
        />
        <span className="Field_Hint">{t('callCenter.leadsStageLimitHint')}</span>
        <Simple_Button text={t('common.save')} type="submit" small auto disabled={!changed || !limitValid || !name.trim()} />
      </form>
      <div className="Leads_Stage_Moves">
        <button type="button" className="Call_Center_Tool" disabled={index === 0} onClick={() => onMove(index - 1)}>
          <span className="Call_Center_Tool_Icon"><Chevron_Left /></span>
          {t('callCenter.leadsStageLeft')}
        </button>
        <button type="button" className="Call_Center_Tool" disabled={index === total - 1} onClick={() => onMove(index + 1)}>
          {t('callCenter.leadsStageRight')}
          <span className="Call_Center_Tool_Icon"><Chevron_Right /></span>
        </button>
      </div>
      {stage.isEntry ? (
        <span className="Call_Center_Sub">{t('callCenter.leadsStageEntryHint')}</span>
      ) : (
        <button type="button" className="Call_Center_Text_Button Leads_Danger" disabled={stage.count > 0} onClick={() => onDelete()}>
          {stage.count > 0 ? t('callCenter.leadsStageNotEmpty') : t('callCenter.leadsStageDelete')}
        </button>
      )}
    </Data_Anchor_Panel>
  );
};

/**
 * Um cartão: o título, o telefone e as colunas escolhidas; por baixo quem a tem, o voltar a ligar, as tentativas e
 * há quanto tempo está na coluna. Arrasta-se para outra coluna (no toque, ao segurar) e abre a gaveta ao clicar; a
 * escolher várias, o clique marca-o.
 */
const Card_View = ({
  card,
  board,
  columns,
  people,
  now,
  selected,
  picking,
  picked,
  draggable,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
  onPointerDown,
}: {
  card: Lead_Card;
  board: Lead_Board;
  columns: Map<string, Lead_Source_Column>;
  people: Map<string, string>;
  now: Date;
  selected: boolean;
  picking: boolean;
  picked: boolean;
  draggable: boolean;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
  onPointerDown: (event: React_Pointer_Event<HTMLButtonElement>) => void;
}) => {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const phone = board.phoneColumn ? card.values[board.phoneColumn] : null;
  const assignee = card.assignedToId ? (people.get(card.assignedToId) ?? null) : null;
  const callback = callbackState(card.callbackAt, now);
  const days = daysInStage(card, now);
  const callbackTime = card.callbackAt
    ? new Date(card.callbackAt).toLocaleString(locale, callback === 'later' ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <button
      type="button"
      data-lead-card={card.rowKey}
      className={`Leads_Card${selected ? ' Selected' : ''}${picked ? ' Picked' : ''}${dragging ? ' Dragging' : ''}${(card.outOfFilter && !card.byRule) || card.archived ? ' Faded' : ''}${callback === 'overdue' ? ' Overdue' : ''}`}
      draggable={draggable && !picking}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onPointerDown={onPointerDown}
      onClick={onOpen}
      aria-pressed={picking ? picked : selected}
    >
      <span className="Leads_Card_Top">
        {picking && (
          <span className={`Leads_Card_Check${picked ? ' On' : ''}`} aria-hidden="true">
            {picked && <Check />}
          </span>
        )}
        <span className="Leads_Card_Title">{cardTitle(card, board.titleColumn, card.values)}</span>
        {assignee && (
          <span className="Leads_Avatar Small" title={t('callCenter.leadsAssignedTo', { name: assignee })}>
            {initialsOf(assignee)}
          </span>
        )}
      </span>
      {phone !== null && phone !== undefined && phone !== '' && (
        <span className={`Leads_Card_Phone${phone === MASKED ? ' Masked' : ''}`}>
          <Phone />
          {String(phone)}
        </span>
      )}
      {callback && (
        <span className={`Leads_Callback ${callback}`}>
          <Clock />
          {callback === 'overdue' ? t('callCenter.leadsCallbackLate', { time: callbackTime }) : t('callCenter.leadsCallbackAt', { time: callbackTime })}
        </span>
      )}
      {board.cardColumns.length > 0 && (
        <span className="Leads_Card_Fields">
          {board.cardColumns.map((key) => {
            const column = columns.get(key);
            if (!column) return null;
            return (
              <span key={key} className="Leads_Card_Field">
                <span className="Leads_Card_Label">{column.label}</span>
                <span className={card.values[key] === MASKED ? 'Masked' : undefined}>{formatCell(card.values[key], column.type, locale)}</span>
              </span>
            );
          })}
        </span>
      )}
      <span className="Leads_Card_Foot">
        {card.attempts > 0 && <span>{t('callCenter.leadsAttempts', { count: card.attempts })}</span>}
        {card.lastOutcome && <span>{card.lastOutcome}</span>}
        {card.comments > 0 && <span>{t('callCenter.leadsCommentsCount', { count: card.comments })}</span>}
        {days > 0 && <span className="Leads_Card_Days" title={t('callCenter.leadsDaysInStageTitle', { count: days })}>{t('callCenter.leadsDaysInStage', { count: days })}</span>}
        {card.byRule && <span className="Leads_Badge Rule">{t('callCenter.leadsByRule', { rule: card.byRule })}</span>}
        {card.outOfFilter && !card.byRule && (
          <span className="Leads_Badge">{t(card.missing ? 'callCenter.leadsMissing' : 'callCenter.leadsOutOfFilter')}</span>
        )}
        {card.archived && <span className="Leads_Badge">{t('callCenter.leadsArchivedBadge')}</span>}
      </span>
    </button>
  );
};

/** A barra de quando se escolhem várias: mover, atribuir, arquivar ou repor todas de uma vez. */
const Bulk_Bar = ({
  count,
  stages,
  people,
  busy,
  showRestore,
  onAction,
  onAll,
  onCancel,
}: {
  count: number;
  stages: Lead_Stage[];
  people: Lead_Person[];
  busy: boolean;
  showRestore: boolean;
  onAction: (action: Lead_Bulk_Action, extra?: { stageId?: string; assignedToId?: string | null }) => void;
  onAll: () => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <div className="Leads_Bulk" role="toolbar" aria-label={t('callCenter.leadsBulkTitle')}>
      <span className="Call_Center_Strong">{t('callCenter.leadsBulkCount', { count })}</span>
      <button type="button" className="Call_Center_Text_Button" onClick={onAll}>
        {t('callCenter.leadsBulkAll')}
      </button>
      <div className="Leads_Bulk_Actions">
        <div className="Leads_Bulk_Field">
          <label htmlFor="lead-bulk-move" className="Leads_Visually_Hidden">{t('callCenter.leadsBulkMove')}</label>
          <Global_Dropdown
            id="lead-bulk-move"
            value=""
            placeholder={t('callCenter.leadsBulkMove')}
            disabled={busy || count === 0}
            onChange={(next) => onAction('move', { stageId: String(next) })}
            options={stages.map((s) => ({ value: s.id, label: s.name }))}
          />
        </div>
        <div className="Leads_Bulk_Field">
          <label htmlFor="lead-bulk-assign" className="Leads_Visually_Hidden">{t('callCenter.leadsBulkAssign')}</label>
          <Global_Dropdown
            id="lead-bulk-assign"
            value=""
            placeholder={t('callCenter.leadsBulkAssign')}
            disabled={busy || count === 0}
            onChange={(next) => onAction('assign', { assignedToId: next === '__none' ? null : String(next) })}
            options={[{ value: '__none', label: t('callCenter.leadsNobody') }, ...people.map((p) => ({ value: p.id, label: p.name }))]}
          />
        </div>
        <Simple_Button text={t('callCenter.leadsArchive')} variant="Ghost" small auto disabled={busy || count === 0} onClick={() => onAction('archive')} />
        {showRestore && <Simple_Button text={t('callCenter.leadsRestore')} variant="Ghost" small auto disabled={busy || count === 0} onClick={() => onAction('restore')} />}
        <button type="button" className="Call_Center_Text_Button" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
};

interface Lead_Board_View_Props {
  companyId: string;
  boardId: string;
  canWork: boolean;
  canManage: boolean;
  onSettings: (board: Lead_Board) => void;
}

/**
 * Uma secção das Leads: as colunas lado a lado, com os cartões. Por cima, a pesquisa e os filtros rápidos (as minhas,
 * sem ninguém, para ligar, paradas). Arrastar um cartão muda-o de coluna (fica logo no sítio novo e grava por trás;
 * no toque, ao segurar); clicar abre a lead à direita. «Escolher» marca várias para as mexer de uma vez.
 */
const Lead_Board_View = ({ companyId, boardId, canWork, canManage, onSettings }: Lead_Board_View_Props) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showArchived, setShowArchived] = useState(false);
  const [showLeft, setShowLeft] = useState(false);
  const { data, error, reload } = useLeadBoard(companyId, boardId, { archived: showArchived, left: showLeft });
  // Um aviso (voltar a ligar) abre o quadro já com a lead aberta: ?lead=<linha>
  const [selected, setSelected] = useState<string | null>(() => searchParams.get('lead'));
  // Os cartões que se acabaram de mexer, até o quadro voltar do servidor
  const [moved, setMoved] = useState<{ data: Lead_Board_Detail | null; map: Record<string, Placement> }>({ data: null, map: {} });
  const [dragging, setDragging] = useState<string | null>(null);
  const [hint, setHint] = useState<{ stageId: string; index: number } | null>(null);
  const hintRef = useRef(hint);
  const [actionError, setActionError] = useState<string | null>(null);
  const [stageMenu, setStageMenu] = useState<{ stageId: string; anchor: HTMLElement } | null>(null);
  const [newStage, setNewStage] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [outcomesOpen, setOutcomesOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [quick, setQuick] = useState<Lead_Quick_Filter>('all');
  const [staleDays, setStaleDays] = useState(3);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const listRefs = useRef(new Map<string, HTMLDivElement>());
  // As colunas ocupam o que sobra do ecrã e cada uma faz scroll dela (a página não)
  const columnsRef = useFitHeight<HTMLDivElement>('height');
  const touch = useRef<{ rowKey: string; x: number; y: number; timer: number; active: boolean } | null>(null);
  const suppressClick = useRef(false);
  const filterText = useFilterText(data?.columns ?? []);

  useVisibleInterval(() => {
    if (!dragging) {
      reload();
      setNow(new Date());
    }
  }, POLL_MS);

  useEffect(() => {
    if (!searchParams.get('lead')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('lead');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const overrides = useMemo(() => (moved.data === data ? moved.map : {}), [moved, data]);
  const columns = useMemo(() => new Map((data?.columns ?? []).map((column) => [column.key, column])), [data]);
  const peopleNames = useMemo(() => new Map((data?.people ?? []).map((p) => [p.id, p.name])), [data]);

  const byStage = useMemo(() => {
    const groups = new Map<string, Lead_Card[]>();
    for (const stage of data?.stages ?? []) groups.set(stage.id, []);
    const visible = filterCards(data?.cards ?? [], { query, quick, staleDays, me: data?.me ?? '', now });
    for (const card of visible) {
      const placed = overrides[card.rowKey];
      const next = placed ? { ...card, ...placed } : card;
      groups.get(next.stageId)?.push(next);
    }
    for (const list of groups.values()) list.sort((a, b) => a.position - b.position);
    return groups;
  }, [data, overrides, query, quick, staleDays, now]);

  const dropAt = (rowKey: string, stageId: string, index: number) => {
    const card = [...byStage.values()].flat().find((c) => c.rowKey === rowKey);
    if (!card || !data) return;
    const others = (byStage.get(stageId) ?? []).filter((c) => c.rowKey !== card.rowKey);
    const position = dropPosition(others, index);
    // Largado onde já estava: nada a gravar
    if (card.stageId === stageId && (byStage.get(stageId) ?? []).findIndex((c) => c.rowKey === card.rowKey) === index) return;
    setMoved({ data, map: { ...overrides, [card.rowKey]: { stageId, position } } });
    setActionError(null);
    leadsApi
      .move(companyId, data.board.id, { rowKey: card.rowKey, stageId, position, from: card.position })
      .catch((reason) => setActionError(getErrorMessage(reason)))
      .finally(reload);
  };
  const dropAtRef = useRef(dropAt);
  // Os ouvintes do toque (no documento) leem sempre o último lugar e a última função
  useEffect(() => {
    hintRef.current = hint;
    dropAtRef.current = dropAt;
  });

  /** Onde cai, pelas coordenadas: a coluna por baixo e o lugar entre os cartões dela. */
  const hintAt = (x: number, y: number, rowKey: string) => {
    const column = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-lead-stage]');
    const stageId = column?.dataset.leadStage;
    if (!stageId) return null;
    const list = listRefs.current.get(stageId);
    const middles = Array.from(list?.querySelectorAll<HTMLElement>('[data-lead-card]') ?? [])
      .filter((element) => element.dataset.leadCard !== rowKey)
      .map((element) => {
        const box = element.getBoundingClientRect();
        return box.top + box.height / 2;
      });
    return { stageId, index: dropIndex(middles, y) };
  };

  // Arrastar no toque: segurar o cartão, mexer o dedo (a página não faz scroll entretanto) e largar
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const current = touch.current;
      if (!current) return;
      if (!current.active) {
        if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > TOUCH_SLOP_PX) {
          window.clearTimeout(current.timer);
          touch.current = null;
        }
        return;
      }
      const next = hintAt(event.clientX, event.clientY, current.rowKey);
      const now = hintRef.current;
      if (next && (!now || now.stageId !== next.stageId || now.index !== next.index)) setHint(next);
    };
    const end = () => {
      const current = touch.current;
      touch.current = null;
      if (!current) return;
      window.clearTimeout(current.timer);
      if (!current.active) return;
      suppressClick.current = true;
      const target = hintRef.current;
      setDragging(null);
      setHint(null);
      if (target) dropAtRef.current(current.rowKey, target.stageId, target.index);
    };
    const block = (event: TouchEvent) => {
      if (touch.current?.active) event.preventDefault();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
    document.addEventListener('touchmove', block, { passive: false });
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', end);
      document.removeEventListener('touchmove', block);
    };
  }, []);

  if (error && !data) return <span className="Call_Center_Message Bad">{error}</span>;
  if (!data) return <span className="Call_Center_Message">{t('common.loading')}</span>;

  const { board, stages } = data;
  const allCards = [...byStage.values()].flat();
  const selectedCard = selected ? (data.cards.find((card) => card.rowKey === selected) ?? null) : null;
  const filtering = Boolean(query.trim()) || quick !== 'all';
  const endOf = (stageId: string) => {
    const list = byStage.get(stageId) ?? [];
    return dropPosition(list, list.length);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>, stageId: string) => {
    if (!dragging) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const next = hintAt(event.clientX, event.clientY, dragging);
    const index = next?.stageId === stageId ? next.index : (byStage.get(stageId)?.length ?? 0);
    if (!hint || hint.stageId !== stageId || hint.index !== index) setHint({ stageId, index });
  };

  const onDrop = (event: DragEvent<HTMLDivElement>, stageId: string) => {
    event.preventDefault();
    const rowKey = dragging;
    const index = hint?.stageId === stageId ? hint.index : (byStage.get(stageId)?.length ?? 0);
    setDragging(null);
    setHint(null);
    if (rowKey) dropAt(rowKey, stageId, index);
  };

  const onCardPointerDown = (card: Lead_Card) => (event: React_Pointer_Event<HTMLButtonElement>) => {
    if (event.pointerType !== 'touch' || !canWork || card.archived || picking) return;
    const state = {
      rowKey: card.rowKey,
      x: event.clientX,
      y: event.clientY,
      active: false,
      timer: window.setTimeout(() => {
        state.active = true;
        setDragging(card.rowKey);
        navigator.vibrate?.(10);
      }, TOUCH_HOLD_MS),
    };
    touch.current = state;
  };

  const onCardClick = (card: Lead_Card) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (picking) {
      setPicked((current) => {
        const next = new Set(current);
        if (next.has(card.rowKey)) next.delete(card.rowKey);
        else next.add(card.rowKey);
        return next;
      });
      return;
    }
    setSelected((current) => (current === card.rowKey ? null : card.rowKey));
  };

  const runBulk = async (action: Lead_Bulk_Action, extra: { stageId?: string; assignedToId?: string | null } = {}) => {
    const rows = allCards.filter((card) => picked.has(card.rowKey)).map((card) => ({ rowKey: card.rowKey, position: card.position }));
    if (!rows.length) return;
    setBulkBusy(true);
    setActionError(null);
    try {
      await leadsApi.bulk(companyId, board.id, { rows, action, ...extra });
      setPicked(new Set());
      setPicking(false);
    } catch (reason) {
      setActionError(getErrorMessage(reason));
    } finally {
      setBulkBusy(false);
      reload();
    }
  };

  const stageAction = async (action: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await action();
      setStageMenu(null);
      reload();
    } catch (reason) {
      setActionError(getErrorMessage(reason));
    }
  };

  const addStage = async (event: FormEvent) => {
    event.preventDefault();
    const name = newStage?.trim();
    if (!name) return;
    await stageAction(() => leadsApi.createStage(companyId, board.id, name));
    setNewStage(null);
  };

  const menuStage = stageMenu ? stages.find((s) => s.id === stageMenu.stageId) : undefined;

  return (
    <div className="Leads_Workspace">
      <div className="Leads_Main">
        <div className="Leads_Board_Head">
          <div className="Leads_Board_Meta">
            <span className="Call_Center_Sub">
              {t('callCenter.leadsFrom', { source: board.sourceName ?? '—' })} · {t('callCenter.leadsTotal', { count: data.total })}
              {data.truncated && ` · ${t('callCenter.leadsTruncated', { count: data.cards.length })}`}
            </span>
            {board.filters.length > 0 && (
              <span className="Leads_Filter_Summary">
                {board.filters.map((filter, index) => (
                  <span key={`${filter.column}-${index}`} className="Leads_Filter_Pill">{filterText(filter)}</span>
                ))}
              </span>
            )}
          </div>
          <div className="Call_Center_Head_Actions">
            {(data.left > 0 || showLeft) && (
              <label className="Call_Center_Check">
                <input type="checkbox" checked={showLeft} onChange={(event) => setShowLeft(event.target.checked)} />
                <span>{t('callCenter.leadsShowLeft', { count: data.left })}</span>
              </label>
            )}
            {(data.archived > 0 || showArchived) && (
              <label className="Call_Center_Check">
                <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
                <span>{t('callCenter.leadsShowArchived', { count: data.archived })}</span>
              </label>
            )}
            {canManage && (
              <button type="button" className="Call_Center_Tool" onClick={() => setOutcomesOpen(true)}>
                <span className="Call_Center_Tool_Icon"><Phone /></span>
                {t('callCenter.leadsOutcomes')}
              </button>
            )}
            {canManage && (
              <button type="button" className="Call_Center_Tool" onClick={() => setRulesOpen(true)}>
                <span className="Call_Center_Tool_Icon"><Sparkles /></span>
                {t('callCenter.leadsRules')}
              </button>
            )}
            {canManage && (
              <button type="button" className="Call_Center_Tool" onClick={() => onSettings(board)}>
                <span className="Call_Center_Tool_Icon"><Sliders /></span>
                {t('callCenter.leadsSettings')}
              </button>
            )}
          </div>
        </div>

        <div className="Leads_Toolbar">
          <label className="Leads_Board_Search">
            <span className="Leads_Board_Search_Icon" aria-hidden="true"><Search /></span>
            <span className="Leads_Visually_Hidden">{t('callCenter.leadsSearch')}</span>
            <input type="search" value={query} placeholder={t('callCenter.leadsSearch')} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="Tabs Leads_Quick" role="group" aria-label={t('callCenter.leadsQuick')}>
            {QUICK_FILTERS.map((option) => (
              <button key={option} type="button" className={quick === option ? 'Active' : ''} aria-pressed={quick === option} onClick={() => setQuick(option)}>
                {t(`callCenter.leadsQuick_${option}`)}
              </button>
            ))}
          </div>
          {quick === 'stale' && (
            <div className="Leads_Stale">
              <label htmlFor="lead-stale-days" className="Leads_Visually_Hidden">{t('callCenter.leadsStaleDays')}</label>
              <Global_Dropdown
                id="lead-stale-days"
                value={staleDays}
                onChange={(next) => setStaleDays(Number(next))}
                options={STALE_DAYS.map((days) => ({ value: days, label: t('callCenter.leadsStaleOption', { count: days }) }))}
              />
            </div>
          )}
          {canWork && (
            <button
              type="button"
              className={`Call_Center_Tool Leads_Pick_Toggle${picking ? ' On' : ''}`}
              aria-pressed={picking}
              onClick={() => {
                setPicking((value) => !value);
                setPicked(new Set());
              }}
            >
              <span className="Call_Center_Tool_Icon"><Check /></span>
              {t('callCenter.leadsPick')}
            </button>
          )}
          {filtering && <span className="Call_Center_Sub">{t('callCenter.leadsShowing', { count: allCards.length, total: data.cards.length })}</span>}
        </div>

        {picking && (
          <Bulk_Bar
            count={picked.size}
            stages={stages}
            people={data.people}
            busy={bulkBusy}
            showRestore={showArchived}
            onAction={runBulk}
            onAll={() => setPicked(new Set(allCards.map((card) => card.rowKey)))}
            onCancel={() => {
              setPicking(false);
              setPicked(new Set());
            }}
          />
        )}

        {data.error && <span className="Call_Center_Message Bad">{t('callCenter.leadsSourceError', { error: data.error })}</span>}
        {actionError && <span className="Call_Center_Message Bad">{actionError}</span>}

        <div ref={columnsRef} className="Leads_Columns">
          {stages.map((stage, index) => {
            const allHere = byStage.get(stage.id) ?? [];
            const open = expanded.has(stage.id) || !stage.cardLimit;
            const cards = open ? allHere : allHere.slice(0, stage.cardLimit ?? allHere.length);
            const hiddenCount = allHere.length - cards.length;
            const active = hint?.stageId === stage.id;
            const count = allHere.filter((card) => !card.archived && (!card.outOfFilter || card.byRule)).length;
            // A linha de onde cai conta os lugares sem o cartão que se arrasta
            let slot = 0;
            return (
              <section
                key={stage.id}
                data-lead-stage={stage.id}
                className={`Leads_Column${active ? ' Drop_Target' : ''}`}
                aria-labelledby={`lead-stage-${stage.id}`}
              >
                <header className="Leads_Column_Head">
                  <h3 id={`lead-stage-${stage.id}`} className="Leads_Column_Title">
                    {stage.name}
                  </h3>
                  <span className="Leads_Column_Count">{count}</span>
                  {canManage && (
                    <button
                      type="button"
                      className="Call_Center_Icon_Button Leads_Column_Menu"
                      aria-label={t('callCenter.leadsStageEdit', { name: stage.name })}
                      title={t('callCenter.leadsStageEdit', { name: stage.name })}
                      onClick={(event) => {
                        const anchor = event.currentTarget;
                        setStageMenu((current) => (current?.stageId === stage.id ? null : { stageId: stage.id, anchor }));
                      }}
                    >
                      <Edit />
                    </button>
                  )}
                </header>
                <div
                  ref={(element) => {
                    if (element) listRefs.current.set(stage.id, element);
                    else listRefs.current.delete(stage.id);
                  }}
                  className="Leads_Column_List"
                  onDragOver={(event) => onDragOver(event, stage.id)}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null) && hint?.stageId === stage.id) setHint(null);
                  }}
                  onDrop={(event) => onDrop(event, stage.id)}
                >
                  {cards.map((card) => {
                    const here = card.rowKey === dragging ? -1 : slot++;
                    return (
                      <div key={card.rowKey} className="Leads_Card_Slot">
                        {active && hint.index === here && <div className="Leads_Drop_Line" aria-hidden="true" />}
                        <Card_View
                          card={card}
                          board={board}
                          columns={columns}
                          people={peopleNames}
                          now={now}
                          selected={card.rowKey === selected}
                          picking={picking}
                          picked={picked.has(card.rowKey)}
                          draggable={canWork && !card.archived}
                          dragging={card.rowKey === dragging}
                          onOpen={() => onCardClick(card)}
                          onPointerDown={onCardPointerDown(card)}
                          onDragStart={(event) => {
                            if (touch.current) {
                              event.preventDefault();
                              return;
                            }
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', card.rowKey);
                            setDragging(card.rowKey);
                          }}
                          onDragEnd={() => {
                            setDragging(null);
                            setHint(null);
                          }}
                        />
                      </div>
                    );
                  })}
                  {active && hint.index >= cards.filter((c) => c.rowKey !== dragging).length && <div className="Leads_Drop_Line" aria-hidden="true" />}
                  {hiddenCount > 0 && (
                    <button type="button" className="Leads_More" onClick={() => setExpanded((current) => new Set(current).add(stage.id))}>
                      {t('callCenter.leadsShowMore', { count: hiddenCount })}
                    </button>
                  )}
                  {stage.cardLimit && expanded.has(stage.id) && allHere.length > stage.cardLimit && (
                    <button
                      type="button"
                      className="Leads_More"
                      onClick={() =>
                        setExpanded((current) => {
                          const next = new Set(current);
                          next.delete(stage.id);
                          return next;
                        })
                      }
                    >
                      {t('callCenter.leadsShowLess')}
                    </button>
                  )}
                  {allHere.length === 0 && !active && (
                    <span className="Leads_Column_Empty">
                      {filtering ? t('callCenter.leadsColumnNoMatch') : stage.isEntry ? t('callCenter.leadsEntryEmpty') : t('callCenter.leadsColumnEmpty')}
                    </span>
                  )}
                </div>
                {index === 0 && stage.isEntry && <span className="Leads_Column_Note">{t('callCenter.leadsEntryNote')}</span>}
              </section>
            );
          })}

          {canManage && (
            <div className="Leads_Add_Column">
              {newStage === null ? (
                <button type="button" className="Call_Center_Tool" onClick={() => setNewStage('')}>
                  <span className="Call_Center_Tool_Icon"><Plus /></span>
                  {t('callCenter.leadsStageAdd')}
                </button>
              ) : (
                <form
                  className="Leads_Stage_Form"
                  onSubmit={addStage}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setNewStage(null);
                  }}
                >
                  <label htmlFor="lead-new-stage" className="Call_Center_Panel_Title">{t('callCenter.leadsStageName')}</label>
                  <Global_Input
                    id="lead-new-stage"
                    value={newStage}
                    maxLength={60}
                    autoComplete="off"
                    placeholder={t('callCenter.leadsStagePlaceholder')}
                    onChange={(event) => setNewStage(event.target.value)}
                  />
                  <div className="Leads_Stage_Form_Actions">
                    <button type="button" className="Call_Center_Text_Button" onClick={() => setNewStage(null)}>
                      {t('common.cancel')}
                    </button>
                    <Simple_Button text={t('callCenter.leadsStageCreate')} type="submit" small auto disabled={!newStage.trim()} />
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedCard && (
        <Lead_Sidebar
          key={selectedCard.rowKey}
          companyId={companyId}
          boardId={board.id}
          card={overrides[selectedCard.rowKey] ? { ...selectedCard, ...overrides[selectedCard.rowKey] } : selectedCard}
          stages={stages}
          outcomes={data.outcomes}
          people={data.people}
          endOf={endOf}
          titleColumn={board.titleColumn}
          phoneColumn={board.phoneColumn}
          canWork={canWork}
          onChanged={reload}
          onClose={() => setSelected(null)}
        />
      )}

      {rulesOpen && (
        <Lead_Rules
          companyId={companyId}
          board={board}
          columns={data.columns}
          stages={stages}
          people={data.people}
          onChanged={reload}
          onClose={() => setRulesOpen(false)}
        />
      )}

      {outcomesOpen && <Lead_Outcomes companyId={companyId} board={board} stages={stages} onChanged={reload} onClose={() => setOutcomesOpen(false)} />}

      {stageMenu && menuStage && (
        <Stage_Menu
          stage={menuStage}
          index={stages.indexOf(menuStage)}
          total={stages.length}
          anchor={stageMenu.anchor}
          onClose={() => setStageMenu(null)}
          onSave={(body) => stageAction(() => leadsApi.updateStage(companyId, board.id, menuStage.id, body))}
          onMove={(position) => stageAction(() => leadsApi.updateStage(companyId, board.id, menuStage.id, { position }))}
          onDelete={() => stageAction(() => leadsApi.deleteStage(companyId, board.id, menuStage.id))}
        />
      )}
    </div>
  );
};

export default Lead_Board_View;
