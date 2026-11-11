import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Autocomplete, TextField } from '@mui/material';
import { useTranslation } from './LocalizationProvider';
import { formatAddress, geocodeAddress, searchStreets } from '../util/addressSearch';

const DELAY_MS = 300;

// ISR-10: an address typed in Hebrew, completed from the official street list; choosing one
// fills its coordinates too (onPick({ address, latitude, longitude })). Typing freely still
// works: the text is kept as the address.
const AddressField = ({ label, value, onChange, onPick, className }) => {
  const t = useTranslation();
  const geocoderUrl = useSelector((state) => state.session.server?.attributes?.['web.geocoderUrl']);
  const [options, setOptions] = useState([]);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const text = (value || '').trim();
    if (text.length < 2) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setOptions(await searchStreets(text, { signal: controller.signal }));
      } catch {
        // no suggestions this time
      }
    }, DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  const pick = async (option) => {
    if (!option || typeof option === 'string') return;
    const address = formatAddress(option);
    onChange(address);
    setLocating(true);
    try {
      const point = await geocodeAddress(address, { url: geocoderUrl });
      onPick?.({ address, ...(point || {}) });
    } catch {
      onPick?.({ address });
    } finally {
      setLocating(false);
    }
  };

  return (
    <Autocomplete
      freeSolo
      className={className}
      options={options}
      filterOptions={(list) => list}
      getOptionLabel={(option) => (typeof option === 'string' ? option : formatAddress(option))}
      isOptionEqualToValue={() => false}
      inputValue={value || ''}
      onInputChange={(_, text, reason) => reason === 'input' && onChange(text)}
      onChange={(_, option) => pick(option)}
      loading={locating}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          helperText={locating ? t('addressLocating') : t('addressHelp')}
        />
      )}
    />
  );
};

export default AddressField;
