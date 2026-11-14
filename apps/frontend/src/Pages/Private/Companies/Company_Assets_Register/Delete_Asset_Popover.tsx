import { useTranslation } from 'react-i18next';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import * as Icon from '../../../../Imports/icons';

interface Delete_Asset_Popover_Props {
  assetName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const Delete_Asset_Popover = ({ assetName, onClose, onConfirm }: Delete_Asset_Popover_Props) => {
  const { t } = useTranslation();

  return (
    <div className="Popover_Backdrop" onClick={onClose}>
      <div className="Popover_Card Narrow" onClick={(e) => e.stopPropagation()}>
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{t('assets.deleteTitle')}</span>
            <span className="Popover_Subtitle">{assetName}</span>
          </div>

          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body">
          <div className="Confirm_Message">
            <Icon.Alert />
            <span>{t('assets.deleteWarning')}</span>
          </div>
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
          </div>
          <div className="Form_Action">
            <Simple_Button text={t('common.delete')} onClick={onConfirm} variant="Danger" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Delete_Asset_Popover;
