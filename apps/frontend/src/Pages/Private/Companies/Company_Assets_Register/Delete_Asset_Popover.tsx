import { useTranslation } from 'react-i18next';
import Confirm_Popover from '../../../../Components/Confirm_Popover/Confirm_Popover';
import * as Icon from '../../../../Imports/icons';

interface Delete_Asset_Popover_Props {
  assetName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const Delete_Asset_Popover = ({ assetName, onClose, onConfirm }: Delete_Asset_Popover_Props) => {
  const { t } = useTranslation();

  return (
    <Confirm_Popover
      title={t('assets.deleteTitle')}
      subtitle={assetName}
      message={
        <>
          <Icon.Alert />
          <span>{t('assets.deleteWarning')}</span>
        </>
      }
      confirmText={t('common.delete')}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
};

export default Delete_Asset_Popover;
