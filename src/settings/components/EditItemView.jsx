import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  onItemSaved,
  menu,
  breadcrumbs,
  title,
  description,
}) => {
  const navigate = useNavigate();

  const { id } = useParams();
  const [saving, setSaving] = useState(false);

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

  const handleSave = useCatch(async () => {
    let url = `api/${endpoint}`;
    if (id) {
      url += `/${id}`;
    }

    setSaving(true);
    try {
      const response = await fetchOrThrow(url, {
        method: !id ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });

      if (onItemSaved) {
        onItemSaved(await response.json());
      }
      navigate(-1);
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
          onCancel={() => navigate(-1)}
          onSave={handleSave}
          saving={saving}
          disabled={!item || !validate()}
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
