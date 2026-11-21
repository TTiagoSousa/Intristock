import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCompany } from '../../../../Contexts/Company_Context';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import { useCountries } from '../../../../Hooks/useCountries';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import { useCompanyBankAccounts } from '../../../../Hooks/Companies/useCompanyBankAccounts';
import {
  useCompanyMember,
  type Company_Member_State,
  type Member_Contract,
  type Member_Detail,
  type Member_Document,
  type Member_Pay,
  type Member_Profile,
} from '../../../../Hooks/Companies/useCompanyMember';
import Record_Page from '../../../../Components/Record_Page/Record_Page';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import * as Icon from '../../../../Imports/icons';
import Member_Pay_Popover from './Member_Pay_Popover';
import Member_Contract_Popover from './Member_Contract_Popover';
import Confirm_Popover from '../../../../Components/Confirm_Popover/Confirm_Popover';
import './Company_Members.scss';
import { localToday } from '../../../../utils/dates';
import { localeOf } from '../../../../utils/locale';
import { activateOnKey } from '../../../../utils/rowKeyboard';

type Member_Tab = 'details' | 'salaries' | 'contracts' | 'documents';
type Profile_Values = Record<keyof Member_Profile, string>;

const PROFILE_KEYS: (keyof Member_Profile)[] = [
  'name',
  'email',
  'phone',
  'jobTitle',
  'taxNumber',
  'socialSecurityNumber',
  'idDocumentNumber',
  'birthDate',
  'addressLine',
  'postalCode',
  'city',
  'countryId',
  'iban',
  'currencyId',
  'bankAccountId',
  'notes',
];

// Os que o backend esconde a quem não trata dos salários nem gere os membros
const PERSONAL_KEYS: (keyof Member_Profile)[] = [
  'taxNumber',
  'socialSecurityNumber',
  'idDocumentNumber',
  'birthDate',
  'addressLine',
  'postalCode',
  'city',
  'iban',
];

const toValues = (member: Member_Detail): Profile_Values =>
  Object.fromEntries(
    PROFILE_KEYS.map((key) => [key, key === 'birthDate' ? (member.birthDate ?? '').slice(0, 10) : (member[key] ?? '')]),
  ) as Profile_Values;

// KB até 1 MB, depois MB
const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * A página de um membro (…/membros/pessoa/<id>), com conta ou sem ela: os dados
 * da pessoa e, a quem pode ver os salários, os salários e recibos verdes, os
 * contratos e os documentos (contratos e afins).
 */
const Company_Member = () => {
  const { slug, memberId } = useParams();
  const { t } = useTranslation();
  const { company, can, loading: loadingCompany } = useCompany();
  const state = useCompanyMember(company?.id, memberId, can('salaries.view'));

  useBreadcrumbSegmentLabel(slug, company?.name);
  useBreadcrumbSegmentLabel(memberId, state.member ? state.member.name || state.member.user?.fullName : undefined);

  const message = (text: string) => (
    <div className="Company_Members">
      <span className="Company_Members_Message">{text}</span>
    </div>
  );

  if (loadingCompany) return message(t('common.loading'));
  if (!company) return message(t('companies.notFound'));
  if (state.notFound) return message(t('companyMembers.notFound'));
  if (state.loading || !state.member) return message(t('common.loading'));

  return <Member_Page key={state.member.id} companyId={company.id} slug={company.slug} member={state.member} state={state} />;
};

const Member_Page = ({
  companyId,
  slug,
  member,
  state,
}: {
  companyId: string;
  slug: string;
  member: Member_Detail;
  state: Company_Member_State;
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = useCompany();
  const { currencies } = useCurrency();
  const { countries } = useCountries();
  const { bankAccounts } = useCompanyBankAccounts(companyId);
  const { formatIn } = useCurrencyFormat();
  const { company } = useCompany();
  const [tab, setTab] = useState<Member_Tab>('details');
  const [values, setValues] = useState<Profile_Values>(() => toValues(member));
  // undefined = fechado, null = criar
  const [editingPay, setEditingPay] = useState<Member_Pay | null | undefined>(undefined);
  const [editingContract, setEditingContract] = useState<Member_Contract | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<
    { kind: 'pay'; item: Member_Pay } | { kind: 'contract'; item: Member_Contract } | { kind: 'document'; item: Member_Document } | null
  >(null);
  // Para onde vai o ficheiro escolhido: um contrato ou solto no membro
  const uploadTarget = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const manageSalaries = can('salaries.manage');
  const currencyCode = member.currency?.shortCode ?? company?.currency.shortCode ?? 'EUR';
  const formatDate = (value: string | null) =>
    value ? new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString(localeOf(i18n.language), { timeZone: 'UTC' }) : '—';
  const money = (value: string | number) => formatIn(Number(value), currencyCode);

  const personalHidden = Boolean(member.personalDataHidden);
  const hiddenNotice = <span className="Field_Hint Full_Width">{t('memberProfile.personalHidden')}</span>;

  const set = (key: keyof Member_Profile) => (value: string) => setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // Só o que mudou; vazio apaga
    // Os dados pessoais escondidos (vieram a nulo) nunca vão no pedido: apagavam os gravados
    const changes = Object.fromEntries(
      PROFILE_KEYS.filter((key) => !(personalHidden && PERSONAL_KEYS.includes(key)))
        .filter((key) => values[key] !== toValues(member)[key])
        .map((key) => [key, values[key] || null]),
    ) as Partial<Member_Profile>;
    if (Object.keys(changes).length > 0) await state.updateProfile(changes);
  };

  const pickFile = (contractId: string | null) => {
    uploadTarget.current = contractId;
    fileInput.current?.click();
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) await state.uploadDocument(file, uploadTarget.current);
    if (fileInput.current) fileInput.current.value = '';
  };

  const text = (key: keyof Member_Profile, label: string, props: { type?: string; full?: boolean } = {}) => (
    <div className={`Form_Field${props.full ? ' Full_Width' : ''}`}>
      <label htmlFor={`member-${key}`}>{t(label)}</label>
      <Global_Input
        id={`member-${key}`}
        type={props.type ?? 'text'}
        value={values[key]}
        onChange={(e) => set(key)(e.target.value)}
      />
    </div>
  );

  const dropdown = (key: keyof Member_Profile, label: string, options: { value: string; label: string }[]) => (
    <div className="Form_Field">
      <label htmlFor={`member-${key}`}>{t(label)}</label>
      <Global_Dropdown
        id={`member-${key}`}
        value={values[key]}
        onChange={(value) => set(key)(String(value))}
        options={[{ value: '', label: t('memberProfile.none') }, ...options]}
      />
    </div>
  );

  const documentRows = (documents: Member_Document[]) =>
    documents.length === 0 ? null : (
      <div className="Member_Documents">
        {documents.map((document) => (
          <div className="Member_Document" key={document.id}>
            <Icon.Doc />
            <div className="Member_Document_Info">
              <span className="Member_Document_Name">{document.fileName}</span>
              <span className="Member_Sub">
                {formatSize(document.size)} · {formatDate(document.createdAt)}
              </span>
            </div>
            <div className="Row_Actions">
              <button
                type="button"
                className="Row_Action"
                onClick={() => state.downloadDocument(document)}
                title={t('documents.download')}
                aria-label={t('documents.download')}
              >
                <Icon.Download />
              </button>
              {manageSalaries && (
                <button
                  type="button"
                  className="Row_Action Danger"
                  onClick={() => setToDelete({ kind: 'document', item: document })}
                  title={t('common.delete')}
                  aria-label={t('common.delete')}
                >
                  <Icon.Trash />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );

  const addButton = (label: string, onClick: () => void) =>
    manageSalaries && (
      <div className="Member_Add">
        <Simple_Button text={t(label)} onClick={onClick} variant="Ghost" small auto disabled={state.uploading} />
      </div>
    );

  const paysSection = (
    <div className="Form_Field Full_Width">
      {state.pays.length === 0 ? (
        <span className="Field_Hint">{t('memberPays.empty')}</span>
      ) : (
        <div className="Table_Wrap">
          <table className="Table">
            <thead>
              <tr>
                <th>{t('memberPays.kind')}</th>
                <th>{t('memberPays.when')}</th>
                <th className="Right">{t('memberPays.gross')}</th>
                <th>{t('memberPays.details')}</th>
                <th className="Col_Actions" />
              </tr>
            </thead>
            <tbody>
              {state.pays.map((pay) => {
                const ended = pay.kind === 'salary' && pay.endDate && pay.endDate.slice(0, 10) < localToday();
                return (
                  <tr key={pay.id} className={manageSalaries ? 'Clickable' : ''} onClick={() => manageSalaries && setEditingPay(pay)} tabIndex={manageSalaries ? 0 : undefined} onKeyDown={activateOnKey}>
                    <td>
                      <span className="Member_Name">{t(`memberPays.kind_${pay.kind}`)}</span>
                      {pay.description && <div className="Member_Sub">{pay.description}</div>}
                    </td>
                    <td>
                      {pay.kind === 'salary'
                        ? t(pay.endDate ? 'memberPays.range' : 'memberPays.since', {
                            from: formatDate(pay.startDate),
                            to: formatDate(pay.endDate),
                          })
                        : formatDate(pay.dueDate)}
                      {ended && <span className="Pill Member_Pill">{t('memberPays.ended')}</span>}
                      {pay.status !== 'accepted' && (
                        <span className={`Pill Member_Pill ${pay.status === 'proposed' ? 'Warn' : 'Bad'}`}>
                          {t(`memberPays.status_${pay.status}`)}
                        </span>
                      )}
                      {pay.responseNote && <div className="Member_Sub">{pay.responseNote}</div>}
                    </td>
                    <td className="Right Num">{money(pay.grossAmount)}</td>
                    <td className="Member_Sub">
                      {pay.kind === 'salary'
                        ? t('memberPays.salaryDetails', { times: pay.paymentsPerYear, day: pay.payDay })
                        : pay.withholdingPct
                          ? t('memberPays.withholdingDetails', { pct: Number(pay.withholdingPct) })
                          : '—'}
                      {pay._count.payments > 0 && ` · ${t('memberPays.paidCount', { count: pay._count.payments })}`}
                    </td>
                    <td className="Right">
                      {manageSalaries && (
                        <div className="Row_Actions">
                          <button
                            type="button"
                            className="Row_Action Danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              setToDelete({ kind: 'pay', item: pay });
                            }}
                            title={t('common.delete')}
                            aria-label={t('common.delete')}
                          >
                            <Icon.Trash />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {addButton('memberPays.add', () => setEditingPay(null))}
    </div>
  );

  const contractsSection = (
    <div className="Form_Field Full_Width">
      {state.contracts.length === 0 && <span className="Field_Hint">{t('memberContracts.empty')}</span>}
      <div className="Member_Contracts">
        {state.contracts.map((contract) => (
          <div className="Member_Contract" key={contract.id}>
            <div className="Member_Contract_Head">
              <div>
                <span className="Member_Name">{contract.title || t(`memberContracts.type_${contract.type}`)}</span>
                <div className="Member_Sub">
                  {[
                    contract.title ? t(`memberContracts.type_${contract.type}`) : null,
                    contract.endDate
                      ? t('memberPays.range', { from: formatDate(contract.startDate), to: formatDate(contract.endDate) })
                      : t('memberPays.since', { from: formatDate(contract.startDate) }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                {contract.notes && <div className="Member_Sub">{contract.notes}</div>}
              </div>
              {manageSalaries && (
                <div className="Row_Actions">
                  <button
                    type="button"
                    className="Row_Action"
                    onClick={() => pickFile(contract.id)}
                    title={t('memberContracts.upload')}
                    aria-label={t('memberContracts.upload')}
                    disabled={state.uploading}
                  >
                    <Icon.Upload />
                  </button>
                  <button
                    type="button"
                    className="Row_Action"
                    onClick={() => setEditingContract(contract)}
                    title={t('common.edit')}
                    aria-label={t('common.edit')}
                  >
                    <Icon.Edit />
                  </button>
                  <button
                    type="button"
                    className="Row_Action Danger"
                    onClick={() => setToDelete({ kind: 'contract', item: contract })}
                    title={t('common.delete')}
                    aria-label={t('common.delete')}
                  >
                    <Icon.Trash />
                  </button>
                </div>
              )}
            </div>
            {documentRows(state.documents.filter((document) => document.contractId === contract.id)) ?? (
              <span className="Field_Hint">{t('memberContracts.noFiles')}</span>
            )}
          </div>
        ))}
      </div>
      {addButton('memberContracts.add', () => setEditingContract(null))}
    </div>
  );

  const documentsSection = (
    <div className="Form_Field Full_Width">
      <span className="Field_Hint">{t('memberDocuments.hint')}</span>
      {documentRows(state.documents) ?? <span className="Field_Hint">{t('documents.empty')}</span>}
      {manageSalaries && (
        <div className="Member_Add">
          <Simple_Button
            text={t(state.uploading ? 'documents.uploading' : 'memberDocuments.add')}
            onClick={() => pickFile(null)}
            variant="Ghost"
            small
            auto
            disabled={state.uploading}
          />
        </div>
      )}
    </div>
  );

  const sections: Record<Member_Tab, { title?: string; content: ReactNode }[]> = {
    details: [
      {
        title: 'memberProfile.section_person',
        content: (
          <>
            {text('name', 'memberProfile.name')}
            {text('jobTitle', 'memberProfile.jobTitle')}
            {text('email', 'memberProfile.email', { type: 'email' })}
            {text('phone', 'memberProfile.phone')}
            {!personalHidden && text('birthDate', 'memberProfile.birthDate', { type: 'date' })}
          </>
        ),
      },
      {
        title: 'memberProfile.section_ids',
        content: (
          <>
            {personalHidden ? (
              hiddenNotice
            ) : (
              <>
                {text('taxNumber', 'memberProfile.taxNumber')}
                {text('socialSecurityNumber', 'memberProfile.socialSecurityNumber')}
                {text('idDocumentNumber', 'memberProfile.idDocumentNumber')}
              </>
            )}
          </>
        ),
      },
      {
        title: 'memberProfile.section_address',
        content: (
          <>
            {personalHidden ? (
              hiddenNotice
            ) : (
              <>
                {text('addressLine', 'memberProfile.addressLine', { full: true })}
                {text('postalCode', 'memberProfile.postalCode')}
                {text('city', 'memberProfile.city')}
              </>
            )}
            {dropdown(
              'countryId',
              'memberProfile.country',
              countries.map((country) => ({ value: country.id, label: country.name })),
            )}
          </>
        ),
      },
      {
        title: 'memberProfile.section_payment',
        content: (
          <>
            {personalHidden ? hiddenNotice : text('iban', 'memberProfile.iban')}
            {dropdown(
              'currencyId',
              'memberProfile.currency',
              currencies.map((currency) => ({ value: currency.id, label: `${currency.shortCode} · ${currency.name}` })),
            )}
            {dropdown(
              'bankAccountId',
              'memberProfile.bankAccount',
              bankAccounts.map((account) => ({ value: account.id, label: account.name })),
            )}
          </>
        ),
      },
      {
        title: 'memberProfile.section_notes',
        content: (
          <div className="Form_Field Full_Width">
            <textarea
              className="Form_Textarea"
              rows={4}
              value={values.notes}
              onChange={(e) => set('notes')(e.target.value)}
              aria-label={t('memberProfile.section_notes')}
            />
          </div>
        ),
      },
    ],
    salaries: [{ content: paysSection }],
    contracts: [{ content: contractsSection }],
    documents: [{ content: documentsSection }],
  };

  const tabs: Member_Tab[] = can('salaries.view') ? ['details', 'salaries', 'contracts', 'documents'] : ['details'];

  return (
    <div className="Company_Members">
      <Record_Page
        title={member.name || member.user?.fullName || t('companyMembers.title')}
        active
        isNew={false}
        tabs={tabs.map((key) => ({ key, label: t(`memberProfile.tab_${key}`) }))}
        activeTab={tab}
        onTabChange={setTab}
        sections={sections[tab]}
        saving={state.saving}
        onSubmit={submit}
        onCancel={() => navigate(`/Companies/${slug}/membros`)}
        // Os dados mudam-se com "gerir membros"; nos outros separadores os botões são os da lista
        readOnly={!can('members.manage')}
      />

      {/* Escondido: quem o abre são os botões de carregar */}
      <input
        ref={fileInput}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        className="Member_File_Input"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {editingPay !== undefined && (
        <Member_Pay_Popover
          pay={editingPay}
          contracts={state.contracts}
          currencyCode={currencyCode}
          saving={state.saving}
          onClose={() => setEditingPay(undefined)}
          onSave={async (input) => {
            if (await state.savePay(editingPay?.id ?? null, input)) setEditingPay(undefined);
          }}
        />
      )}

      {editingContract !== undefined && (
        <Member_Contract_Popover
          contract={editingContract}
          saving={state.saving}
          onClose={() => setEditingContract(undefined)}
          onSave={async (input) => {
            if (await state.saveContract(editingContract?.id ?? null, input)) setEditingContract(undefined);
          }}
        />
      )}

      {toDelete && (
        <Confirm_Popover
          title={t(`memberProfile.delete_${toDelete.kind}`)}
          subtitle={
            toDelete.kind === 'document'
              ? toDelete.item.fileName
              : toDelete.kind === 'contract'
                ? toDelete.item.title || t(`memberContracts.type_${toDelete.item.type}`)
                : t(`memberPays.kind_${toDelete.item.kind}`)
          }
          message={t(`memberProfile.delete_${toDelete.kind}Confirm`)}
          confirmText={t('common.delete')}
          busy={state.saving}
          onClose={() => setToDelete(null)}
          onConfirm={async () => {
            const done =
              toDelete.kind === 'pay'
                ? await state.deletePay(toDelete.item.id)
                : toDelete.kind === 'contract'
                  ? await state.deleteContract(toDelete.item.id)
                  : await state.deleteDocument(toDelete.item.id);
            if (done) setToDelete(null);
          }}
        />
      )}
    </div>
  );
};

export default Company_Member;
