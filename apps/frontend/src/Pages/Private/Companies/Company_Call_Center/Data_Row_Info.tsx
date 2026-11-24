import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from '../../../../Imports/icons';
import Data_Anchor_Panel from './Data_Anchor_Panel';

export interface Row_Info_Field {
  key: string;
  label: ReactNode;
  value: ReactNode;
}

/** O botão «Info» no fim de uma linha: abre por cima da página a linha toda (cada coluna e o valor dela). */
const Data_Row_Info = ({ title, fields }: { title: ReactNode; fields: Row_Info_Field[] }) => {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <button
        type="button"
        className={`Call_Center_Icon_Button${anchor ? ' Active' : ''}`}
        aria-label={t('callCenter.rowInfo')}
        title={t('callCenter.rowInfo')}
        aria-expanded={Boolean(anchor)}
        onClick={(event) => {
          event.stopPropagation();
          const target = event.currentTarget;
          setAnchor((current) => (current ? null : target));
        }}
      >
        <Info />
      </button>
      {anchor && (
        <Data_Anchor_Panel anchor={anchor} onClose={() => setAnchor(null)} label={t('callCenter.rowInfo')} className="Call_Center_Info">
          <div className="Call_Center_Panel_Title">{title}</div>
          {fields.length === 0 ? (
            <span className="Call_Center_Sub">{t('callCenter.rowInfoEmpty')}</span>
          ) : (
            <dl className="Call_Center_Info_List">
              {fields.map((field) => (
                <div key={field.key} className="Call_Center_Info_Item">
                  <dt>{field.label}</dt>
                  <dd>{field.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </Data_Anchor_Panel>
      )}
    </>
  );
};

export default Data_Row_Info;
