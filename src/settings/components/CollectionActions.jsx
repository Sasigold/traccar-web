import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useNavigate } from 'react-router-dom';
import RowActions from '../../common/components/table/RowActions';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useConfirm } from '../../common/components/confirm/ConfirmProvider';
import { useCatch } from '../../reactHelper';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { archiveFleetVehicle } from '../../common/fleet/fleetArchive';

// Removals that cannot be undone and take a lot with them: the user types the name (ADM-05).
const TYPE_TO_CONFIRM = ['devices', 'users'];

const CollectionActions = ({
  itemId,
  itemName,
  editPath,
  endpoint,
  onReload,
  customActions,
  readonly,
}) => {
  const navigate = useNavigate();
  const t = useTranslation();
  const confirm = useConfirm();

  // ADM-05: the confirmation names the item and says what goes with it.
  const remove = useCatch(async () => {
    const key = `removeConsequence_${endpoint.replace('/', '_')}`;
    const consequence = t(key);
    const ok = await confirm({
      title: itemName ? t('sharedRemoveNamed').replace('{0}', itemName) : t('sharedRemoveConfirm'),
      message: consequence === key ? null : consequence,
      confirmLabel: t('sharedRemove'),
      typeToConfirm: TYPE_TO_CONFIRM.includes(endpoint) ? itemName : undefined,
    });
    if (!ok) {
      return;
    }
    await fetchOrThrow(`api/${endpoint}/${itemId}`, { method: 'DELETE' });
    if (endpoint === 'devices') {
      // The fleet keeps the vehicle's work orders and documents, as an archived vehicle.
      await archiveFleetVehicle(itemId);
    }
    onReload();
  });

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
            onClick: remove,
          },
        ]
      : []),
  ];

  return <RowActions actions={actions} />;
};

export default CollectionActions;
