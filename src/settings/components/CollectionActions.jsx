import { useState } from 'react';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useNavigate } from 'react-router-dom';
import RemoveDialog from '../../common/components/RemoveDialog';
import RowActions from '../../common/components/table/RowActions';
import { useTranslation } from '../../common/components/LocalizationProvider';

const CollectionActions = ({ itemId, editPath, endpoint, onReload, customActions, readonly }) => {
  const navigate = useNavigate();
  const t = useTranslation();

  const [removing, setRemoving] = useState(false);

  const handleRemoveResult = (removed) => {
    setRemoving(false);
    if (removed) {
      onReload();
    }
  };

  const actions = [
    ...(customActions || []).map((action) => ({
      key: action.key,
      title: action.title,
      icon: action.icon,
      onClick: () => action.handler(itemId),
    })),
    ...(!readonly && editPath
      ? [
          {
            key: 'edit',
            title: t('sharedEdit'),
            icon: <EditRoundedIcon fontSize="small" />,
            onClick: () => navigate(`${editPath}/${itemId}`),
          },
        ]
      : []),
    ...(!readonly
      ? [
          {
            key: 'remove',
            title: t('sharedRemove'),
            icon: <DeleteOutlineRoundedIcon fontSize="small" />,
            color: 'error',
            onClick: () => setRemoving(true),
          },
        ]
      : []),
  ];

  return (
    <>
      <RowActions actions={actions} />
      <RemoveDialog
        style={{ transform: 'none' }}
        open={removing}
        endpoint={endpoint}
        itemId={itemId}
        onResult={handleRemoveResult}
      />
    </>
  );
};

export default CollectionActions;
