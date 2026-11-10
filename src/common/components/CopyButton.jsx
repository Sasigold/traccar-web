import { useEffect, useState } from 'react';
import { Button, IconButton, Tooltip } from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { useTranslation } from './LocalizationProvider';

export const COPIED_MS = 2000;

// ADM-28: copying says so: "Copied ✓" for two seconds, also to a screen reader.
const CopyButton = ({ text, label, icon = false, size = 'small', variant = 'text', ...props }) => {
  const t = useTranslation();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    await navigator.clipboard?.writeText(text ?? '');
    setCopied(true);
  };
  const name = copied ? t('sharedCopiedCheck') : label || t('sharedCopy');

  if (icon) {
    return (
      <Tooltip title={name} open={copied || undefined}>
        <span>
          <IconButton size={size} aria-label={name} onClick={copy} disabled={!text} {...props}>
            {copied ? (
              <CheckRoundedIcon fontSize="small" color="success" />
            ) : (
              <ContentCopyRoundedIcon fontSize="small" />
            )}
          </IconButton>
        </span>
      </Tooltip>
    );
  }
  return (
    <Button
      size={size}
      variant={variant}
      startIcon={copied ? <CheckRoundedIcon /> : <ContentCopyRoundedIcon />}
      onClick={copy}
      disabled={!text}
      aria-live="polite"
      {...props}
    >
      {name}
    </Button>
  );
};

export default CopyButton;
