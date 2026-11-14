import { useTranslation } from 'react-i18next';
import type { ReleaseNotes } from '../../Hooks/System/types';
import './Release_Notes.scss';

const SECTIONS: (keyof ReleaseNotes)[] = ['features', 'fixes', 'improvements', 'other'];

// As notas marcam o âmbito a negrito (**empresa**: …); o resto é texto simples
const renderItem = (text: string) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );

interface Release_Notes_Props {
  notes: ReleaseNotes;
  limit?: number;
}

const Release_Notes = ({ notes, limit }: Release_Notes_Props) => {
  const { t } = useTranslation();
  const sections = SECTIONS.filter((key) => notes[key].length > 0);
  if (sections.length === 0) return <p className="Release_Notes_Empty">{t('versions.notesEmpty')}</p>;

  return (
    <div className="Release_Notes">
      {sections.map((section) => {
        const items = notes[section];
        const shown = limit ? items.slice(0, limit) : items;
        return (
          <div key={section} className={`Release_Notes_Section ${section}`}>
            <span className="Release_Notes_Label Eyebrow">
              {t(`versions.notes.${section}`)} <em>{items.length}</em>
            </span>
            <ul>
              {shown.map((item, i) => (
                <li key={i}>{renderItem(item)}</li>
              ))}
              {limit && items.length > limit && (
                <li className="More">{t('versions.notesMore', { count: items.length - limit })}</li>
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

export default Release_Notes;
