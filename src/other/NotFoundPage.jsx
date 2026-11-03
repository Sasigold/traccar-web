import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { BrandSymbol } from '../common/components/brand/BrandLogo';
import { useTranslation } from '../common/components/LocalizationProvider';

const NotFoundPage = () => {
  const t = useTranslation();
  const navigate = useNavigate();

  return (
    <Box
      component="main"
      sx={{
        flex: 1,
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 2,
        p: 3,
        bgcolor: 'background.default',
      }}
    >
      <BrandSymbol size={56} />
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: 'text.primary' }}>
        404
      </Typography>
      <Typography variant="h6" component="p" sx={{ color: 'text.primary' }}>
        {t('notFoundTitle')}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 360 }}>
        {t('notFoundDescription')}
      </Typography>
      <Button variant="contained" onClick={() => navigate('/', { replace: true })}>
        {t('notFoundBack')}
      </Button>
    </Box>
  );
};

export default NotFoundPage;
