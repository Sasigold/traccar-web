import { useState } from 'react';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useConfirm } from '../../common/components/confirm/ConfirmProvider';
import {
  discardUnsavedChanges,
  goBack,
  listPathOf,
  useFormChanges,
  useLeaveGuard,
} from '../../common/components/confirm/unsavedChanges';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { messagesActions } from '../../store';
import { Skeleton } from '@mui/material';
import { useCatch, useAsyncTask } from '../../reactHelper';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import FormPage from './FormPage';
import FormSection from './FormSection';
import SaveBar from './SaveBar';

const EditItemView = ({
  children,
  endpoint,
  item,
  setItem,
  defaultItem,
  validate,
  prepare = (value) => value,
  onItemSaved,
  menu,
  breadcrumbs,
  title,
  description,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const { id } = useParams();
  const [saving, setSaving] = useState(false);
  const t = useTranslation();
  const dispatch = useDispatch();
  const leave = useLeaveGuard(useConfirm(), t);
  // ADM-05: anything different from the item as loaded is an unsaved change.
  useFormChanges(item, Boolean(item));

  useAsyncTask(
    async ({ signal }) => {
      if (!item) {
        if (id) {
          const response = await fetchOrThrow(`api/${endpoint}/${id}`, { signal });
          setItem(await response.json());
        } else {
          setItem(defaultItem || {});
        }
      }
    },
    [id, item, defaultItem, endpoint, setItem],
  );

  // ADM-14: "save and continue" keeps a new item open at its own address (/<entity>/<id>), where
  // the parts that need a saved item (documents, links, maintenance) open.
  const handleSave = useCatch(async (stay = false) => {
    let url = `api/${endpoint}`;
    if (id) {
      url += `/${id}`;
    }

    setSaving(true);
    try {
      const response = await fetchOrThrow(url, {
        method: !id ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prepare(item)),
      });

      const saved = await response.json();
      if (onItemSaved) {
        await onItemSaved(saved);
      }
      // ADM-28: the save says what was saved, by name.
      const name = item.name || item.description || saved?.name || saved?.description;
      dispatch(
        messagesActions.push({
          message: name ? t('sharedSavedNamed').replace('{0}', name) : t('sharedSaved'),
          severity: 'success',
        }),
      );
      discardUnsavedChanges();
      if (stay && saved?.id) {
        navigate(`${location.pathname.replace(/\/$/, '')}/${saved.id}${location.search}`, {
          replace: true,
        });
      } else {
        goBack(navigate, listPathOf(location.pathname));
      }
    } finally {
      setSaving(false);
    }
  });

  return (
    <FormPage
      menu={menu}
      breadcrumbs={breadcrumbs}
      title={title}
      description={description}
      footer={
        <SaveBar
          onCancel={() => leave(() => goBack(navigate, listPathOf(location.pathname)))}
          onSave={() => handleSave(false)}
          onSaveAndContinue={id ? undefined : () => handleSave(true)}
          saving={saving}
          disabled={!item || !validate()}
          disabledHint={item ? t('sharedSaveNeedsRequired') : undefined}
        />
      }
    >
      {item ? (
        children
      ) : (
        <FormSection title={<Skeleton width="10em" />}>
          {[...Array(3)].map((_, i) => (
            <Skeleton key={-i} variant="rounded" height={40} />
          ))}
        </FormSection>
      )}
    </FormPage>
  );
};

export default EditItemView;
