import { useState } from 'react';

import {
  Button,
  Checkbox,
  OutlinedInput,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  Tooltip,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AddAttributeDialog from './AddAttributeDialog';
import FormSection from './FormSection';
import { useTranslation } from '../../common/components/LocalizationProvider';
import useAttributeUnits from '../../common/util/useAttributeUnits';
import {
  attributeFromRaw,
  attributeToRaw,
  attributeUnitString,
} from '../../common/util/attributeUnits';
import useFeatures from '../../common/util/useFeatures';
import VehicleProfileSummary, {
  isProfileKey,
} from '../../common/components/telemetry/VehicleProfileSummary';

const useStyles = makeStyles()((theme) => ({
  booleanRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    paddingInlineStart: theme.spacing(0.5),
    borderRadius: theme.tokens.radius.md,
    border: `1px solid ${theme.palette.surface.border}`,
    backgroundColor: theme.palette.surface.sunken,
    '& .MuiFormControlLabel-root': {
      flex: 1,
      marginInlineEnd: 0,
    },
  },
  remove: {
    marginInlineEnd: theme.spacing(0.5),
  },
  empty: {
    color: theme.palette.text.secondary,
  },
}));

// Free-form attribute editor shown on most edit pages. The file keeps its
// historical name; it now renders a FormSection card.
const EditAttributesAccordion = ({
  attribute,
  attributes,
  setAttributes,
  definitions,
  focusAttribute,
  itemId,
}) => {
  const { classes } = useStyles();
  const t = useTranslation();

  const features = useFeatures();

  const units = useAttributeUnits();

  const [addDialogShown, setAddDialogShown] = useState(false);

  const updateAttribute = (key, value, type, dataType) => {
    const updatedAttributes = { ...attributes };
    updatedAttributes[key] = attributeToRaw(
      type === 'number' ? Number(value) : value,
      dataType,
      units,
    );
    setAttributes(updatedAttributes);
  };

  const deleteAttribute = (key) => {
    const updatedAttributes = { ...attributes };
    delete updatedAttributes[key];
    setAttributes(updatedAttributes);
  };

  const getAttributeName = (key, dataType) => {
    const definition = definitions[key];
    const name = definition ? definition.name : key;
    const unit = attributeUnitString(dataType, units, t);
    return unit ? `${name} (${unit})` : name;
  };

  const getAttributeType = (value) => {
    if (typeof value === 'number') {
      return 'number';
    }
    if (typeof value === 'boolean') {
      return 'boolean';
    }
    return 'string';
  };

  const getAttributeDataType = (key) => {
    const definition = definitions[key];
    return definition && definition.dataType;
  };

  const getDisplayValue = (value, dataType) => attributeFromRaw(value, dataType, units) ?? '';

  const convertToList = (attributes) => {
    const booleanList = [];
    const otherList = [];
    const excludeAttributes = [
      'speedUnit',
      'distanceUnit',
      'altitudeUnit',
      'volumeUnit',
      'timezone',
    ];
    Object.keys(attributes || [])
      .filter((key) => !excludeAttributes.includes(key) && !isProfileKey(key))
      .forEach((key) => {
        const value = attributes[key];
        const type = getAttributeType(value);
        const dataType = getAttributeDataType(key);
        if (type === 'boolean') {
          booleanList.push({
            key,
            value,
            type,
            dataType,
          });
        } else {
          otherList.push({
            key,
            value,
            type,
            dataType,
          });
        }
      });
    return [...otherList, ...booleanList];
  };

  const handleAddResult = (definition) => {
    setAddDialogShown(false);
    if (definition) {
      switch (definition.type) {
        case 'number':
          updateAttribute(definition.key, 0);
          break;
        case 'boolean':
          updateAttribute(definition.key, false);
          break;
        default:
          updateAttribute(definition.key, '');
          break;
      }
    }
  };

  if (features.disableAttributes) {
    return '';
  }

  const list = convertToList(attributes);
  const profileKey = Object.keys(attributes || {}).find(isProfileKey);
  void attribute;

  return (
    <FormSection
      title={t('attributesSectionTitle')}
      description={t('attributesSectionHelp')}
      actions={
        <Button
          variant="outlined"
          size="small"
          onClick={() => setAddDialogShown(true)}
          startIcon={<AddRoundedIcon />}
        >
          {t('sharedAdd')}
        </Button>
      }
    >
      {profileKey && (
        <VehicleProfileSummary
          device={{ id: itemId, attributes }}
          onRemove={() => deleteAttribute(profileKey)}
        />
      )}
      {list.length === 0 && !profileKey && (
        <Typography variant="body2" className={classes.empty}>
          {t('attributesSectionEmpty')}
        </Typography>
      )}
      {list.map(({ key, value, type, dataType }) => {
        if (type === 'boolean') {
          return (
            <div className={classes.booleanRow} key={key}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={value}
                    onChange={(e) => updateAttribute(key, e.target.checked)}
                  />
                }
                label={getAttributeName(key, dataType)}
              />
              <Tooltip title={t('sharedRemove')}>
                <IconButton
                  size="small"
                  className={classes.remove}
                  onClick={() => deleteAttribute(key)}
                >
                  <CloseRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </div>
          );
        }
        return (
          <FormControl key={key}>
            <InputLabel htmlFor={`attribute-${key}`}>{getAttributeName(key, dataType)}</InputLabel>
            <OutlinedInput
              id={`attribute-${key}`}
              label={getAttributeName(key, dataType)}
              type={type === 'number' ? 'number' : 'text'}
              value={getDisplayValue(value, dataType)}
              onChange={(e) => updateAttribute(key, e.target.value, type, dataType)}
              autoFocus={focusAttribute === key}
              endAdornment={
                <InputAdornment position="end">
                  <IconButton
                    aria-label={t('sharedRemove')}
                    size="small"
                    edge="end"
                    onClick={() => deleteAttribute(key)}
                  >
                    <CloseRoundedIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              }
            />
          </FormControl>
        );
      })}
      <AddAttributeDialog
        open={addDialogShown}
        onResult={handleAddResult}
        definitions={definitions}
      />
    </FormSection>
  );
};

export default EditAttributesAccordion;
