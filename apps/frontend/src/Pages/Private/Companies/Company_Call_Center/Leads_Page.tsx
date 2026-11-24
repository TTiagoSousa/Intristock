import { useState } from 'react';
import { Navigate, NavLink, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCompany } from '../../../../Contexts/Company_Context';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import { callCenterBase } from '../../../../Containers/Navs/Navigation_Home/Menu_Itins';
import { useLeadBoards, type Lead_Board } from '../../../../Hooks/Companies/useCompanyLeads';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import { Plus } from '../../../../Imports/icons';
import Data_Shell from './Data_Shell';
import Lead_Board_View from './Lead_Board';
import Lead_Board_Settings from './Lead_Board_Settings';
import './Leads.scss';

const Leads_Body = ({ company }: { company: { id: string; slug: string } }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { boardId } = useParams();
  const { can } = useCompany();
  const { data: boards, error, reload } = useLeadBoards(company.id);
  // As definições precisam das tabelas (a origem e a lista dos valores dos filtros): quem gere vê também os Dados
  const canManage = can('leads.manage') && can('data.view');
  const canWork = can('leads.work');
  const [editing, setEditing] = useState<Lead_Board | 'new' | null>(null);
  const base = `${callCenterBase(company.slug)}/leads`;
  const current = boards?.find((board) => board.id === boardId);

  useBreadcrumbSegmentLabel(boardId, current?.name);

  if (error && !boards) return <span className="Call_Center_Message Bad">{error}</span>;
  if (!boards) return <span className="Call_Center_Message">{t('common.loading')}</span>;
  // Sem secção escolhida abre a primeira; uma que já não existe volta à lista
  if (!boardId && boards.length) return <Navigate to={`${base}/${boards[0].id}`} replace />;
  if (boardId && !current) return <Navigate to={base} replace />;

  return (
    <>
      <div className="Leads_Tabs_Bar">
        <nav className="Leads_Tabs" aria-label={t('callCenter.leadsSections')}>
          {boards.map((board) => (
            <NavLink key={board.id} to={`${base}/${board.id}`} className={({ isActive }) => `Leads_Tab${isActive ? ' Active' : ''}`}>
              {board.name}
            </NavLink>
          ))}
        </nav>
        {canManage && (
          <button type="button" className="Call_Center_Tool" onClick={() => setEditing('new')}>
            <span className="Call_Center_Tool_Icon"><Plus /></span>
            {t('callCenter.leadsNewBoard')}
          </button>
        )}
      </div>

      {boards.length === 0 ? (
        <div className="Card Leads_Empty">
          <div className="Empty_State">
            <span className="Empty_State_Title">{t('callCenter.leadsEmptyTitle')}</span>
            <span className="Empty_State_Text">{t(canManage ? 'callCenter.leadsEmptyText' : 'callCenter.leadsEmptyTextNoManage')}</span>
            {canManage && <Simple_Button text={t('callCenter.leadsNewBoard')} small auto onClick={() => setEditing('new')} />}
          </div>
        </div>
      ) : (
        current && (
          <Lead_Board_View
            key={`${current.id}-${current.updatedAt ?? ''}`}
            companyId={company.id}
            boardId={current.id}
            canWork={canWork}
            canManage={canManage}
            onSettings={(board) => setEditing(board)}
          />
        )
      )}

      {editing && (
        <Lead_Board_Settings
          companyId={company.id}
          board={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            reload();
            navigate(`${base}/${saved.id}`);
          }}
          onDeleted={() => {
            setEditing(null);
            reload();
            navigate(base);
          }}
        />
      )}
    </>
  );
};

/** As Leads do call center: as secções lá em cima e o quadro da escolhida. */
const Leads_Page = () => <Data_Shell>{(company) => <Leads_Body company={company} />}</Data_Shell>;

export default Leads_Page;
