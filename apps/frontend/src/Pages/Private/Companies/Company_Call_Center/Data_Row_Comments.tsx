import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRowComments, type Lead_Source_Type } from '../../../../Hooks/Companies/useCompanyLeads';
import { localeOf } from '../../../../utils/locale';
import Data_Anchor_Panel from './Data_Anchor_Panel';
import { initialsOf, relativeTime } from './leadHelpers';
import './Leads.scss';

/** Os comentários de uma linha, de todas as secções das Leads que a usam (só de leitura; mudam-se na lead). */
const Comments_List = ({ companyId, sourceType, sourceId, row }: { companyId: string; sourceType: Lead_Source_Type; sourceId: string; row: string }) => {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const { data, error } = useRowComments(companyId, sourceType, sourceId, row);
  const [now] = useState(() => new Date());
  if (error && !data) return <span className="Call_Center_Message Bad">{error}</span>;
  if (!data) return <span className="Call_Center_Sub">{t('common.loading')}</span>;
  if (!data.length) return <span className="Call_Center_Sub">{t('callCenter.leadsNoComments')}</span>;
  return (
    <ul className="Leads_Comments Call_Center_Row_Comments">
      {data.map((comment) => (
        <li key={comment.id} className={`Leads_Comment${comment.mine ? ' Mine' : ''}`}>
          <span className="Leads_Avatar" aria-hidden="true">{initialsOf(comment.userName)}</span>
          <div className="Leads_Comment_Main">
            <div className="Leads_Comment_Head">
              <span className="Leads_Comment_Author">{comment.userName ?? t('callCenter.leadsSomeone')}</span>
              <time className="Leads_Comment_Time" dateTime={comment.createdAt} title={new Date(comment.createdAt).toLocaleString(locale)}>
                {relativeTime(comment.createdAt, now, locale)}
              </time>
            </div>
            <p className="Leads_Comment_Body">{comment.body}</p>
            <span className="Leads_Comment_Time">{t('callCenter.rowCommentsIn', { board: comment.boardName })}</span>
          </div>
        </li>
      ))}
    </ul>
  );
};

/**
 * O número de comentários de uma linha, ao lado do «Info» (só aparece com comentários): abre-os por cima da página.
 * Os comentários escrevem-se nas Leads; aqui só se leem.
 */
const Data_Row_Comments = ({
  companyId,
  sourceType,
  sourceId,
  row,
  count,
}: {
  companyId: string;
  sourceType: Lead_Source_Type;
  sourceId: string;
  row: string;
  count: number;
}) => {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (count <= 0) return null;
  return (
    <>
      <button
        type="button"
        className={`Call_Center_Comment_Count${anchor ? ' Active' : ''}`}
        aria-label={t('callCenter.rowComments', { count })}
        title={t('callCenter.rowComments', { count })}
        aria-expanded={Boolean(anchor)}
        onClick={(event) => {
          event.stopPropagation();
          const target = event.currentTarget;
          setAnchor((current) => (current ? null : target));
        }}
      >
        {count}
      </button>
      {anchor && (
        <Data_Anchor_Panel anchor={anchor} onClose={() => setAnchor(null)} label={t('callCenter.rowComments', { count })} className="Call_Center_Info">
          <div className="Call_Center_Panel_Title">{t('callCenter.rowComments', { count })}</div>
          <Comments_List companyId={companyId} sourceType={sourceType} sourceId={sourceId} row={row} />
        </Data_Anchor_Panel>
      )}
    </>
  );
};

export default Data_Row_Comments;
