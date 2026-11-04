import { useState } from 'react';
import { TextField } from '@mui/material';
import EditItemView from './components/EditItemView';
import { useTranslation } from '../common/components/LocalizationProvider';
import BaseCommandView from './components/BaseCommandView';
import SettingsMenu from './components/SettingsMenu';
import FormSection from './components/FormSection';

const CommandPage = () => {
  const t = useTranslation();

  const [item, setItem] = useState();

  const validate = () => item && item.type;

  return (
    <EditItemView
      endpoint="commands"
      item={item}
      setItem={setItem}
      validate={validate}
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'sharedSavedCommand']}
    >
      {item && (
        <FormSection title={t('sharedRequired')}>
          <TextField
            value={item.description || ''}
            onChange={(event) => setItem({ ...item, description: event.target.value })}
            label={t('sharedDescription')}
          />
          <BaseCommandView item={item} setItem={setItem} />
        </FormSection>
      )}
    </EditItemView>
  );
};

export default CommandPage;
