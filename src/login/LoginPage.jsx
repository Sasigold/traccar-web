import { useEffect, useRef, useState } from 'react';
import {
  Select,
  MenuItem,
  FormControl,
  Button,
  TextField,
  Link,
  Alert,
  IconButton,
  Tooltip,
  Typography,
  InputAdornment,
  useTheme,
} from '@mui/material';
import CountryFlag from 'react-country-flag';
import { makeStyles } from 'tss-react/mui';
import { keyframes } from 'tss-react';
import VpnLockIcon from '@mui/icons-material/VpnLockRounded';
import QrCode2Icon from '@mui/icons-material/QrCode2Rounded';
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { alpha } from '@mui/material/styles';
import { ctaFill } from '../common/theme/surfaces';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { sessionActions } from '../store';
import { useLocalization, useTranslation } from '../common/components/LocalizationProvider';
import LoginLayout from './LoginLayout';
import usePersistedState from '../common/util/usePersistedState';
import {
  generateLoginToken,
  handleLoginTokenListeners,
  nativeEnvironment,
  nativePostMessage,
} from '../common/components/NativeInterface';
import { useCatch } from '../reactHelper';
import ServerQrCodeDialog from '../common/components/ServerQrCodeDialog';
import PasswordField from '../common/components/PasswordField';

const rise = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
`;

const shake = [
  { transform: 'translateX(0)' },
  { transform: 'translateX(-8px)' },
  { transform: 'translateX(7px)' },
  { transform: 'translateX(-5px)' },
  { transform: 'translateX(3px)' },
  { transform: 'translateX(0)' },
];

const useStyles = makeStyles()((theme) => ({
  options: {
    position: 'fixed',
    top: `calc(${theme.spacing(2)} + env(safe-area-inset-top, 0px))`,
    insetInlineEnd: theme.spacing(2),
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
    zIndex: 2,
    '& .MuiOutlinedInput-root': {
      borderRadius: theme.tokens.radius.pill,
      backgroundColor: theme.palette.background.paper,
    },
  },
  optionButton: {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.surface.border}`,
    '&:hover': {
      backgroundColor: theme.palette.surface.tint,
    },
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    '& > *': {
      animation: `${rise} 560ms ${theme.tokens.motion.easing.emphasized} both`,
    },
    // Sibling chains instead of :nth-child, which emotion flags as SSR-unsafe.
    ...Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [
        `& > *${' + *'.repeat(i)}`,
        { animationDelay: `${240 + i * 60}ms` },
      ]),
    ),
    '& .MuiOutlinedInput-root': {
      borderRadius: theme.tokens.radius.md,
      transition: `box-shadow ${theme.tokens.motion.duration.base}ms ${theme.tokens.motion.easing.standard}`,
      '&.Mui-focused': {
        boxShadow: `0 0 0 4px ${alpha(theme.palette.secondary.main, 0.18)}`,
      },
    },
    '& .MuiInputAdornment-positionStart': {
      color: theme.palette.text.secondary,
    },
    '& .Mui-focused .MuiInputAdornment-positionStart': {
      color: theme.palette.primary.main,
    },
  },
  extraContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing(4),
    marginTop: theme.spacing(2),
  },
  registerButton: {
    minWidth: 'unset',
  },
  link: {
    cursor: 'pointer',
  },
  flag: {
    marginInlineEnd: theme.spacing(1),
  },
  heading: {
    marginBottom: theme.spacing(1),
  },
  title: {
    fontWeight: 600,
    letterSpacing: '-0.02em',
    marginBottom: theme.spacing(0.5),
  },
  subtitle: {
    color: theme.palette.text.secondary,
  },
  cta: {
    height: 52,
    marginTop: theme.spacing(1),
    fontSize: '1rem',
    fontWeight: 600,
    borderRadius: theme.tokens.radius.md,
    ...ctaFill(theme),
    '& .MuiButton-endIcon': {
      transition: `transform ${theme.tokens.motion.duration.slow}ms ${theme.tokens.motion.easing.emphasized}`,
    },
    '&:hover .MuiButton-endIcon': {
      transform: `translateX(${theme.direction === 'rtl' ? -4 : 4}px)`,
    },
  },
}));

const LoginPage = () => {
  const { classes } = useStyles();
  const theme = useTheme();
  const containerRef = useRef(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const t = useTranslation();

  const { languages, language, setLocalLanguage } = useLocalization();
  const languageList = Object.entries(languages).map((values) => ({
    code: values[0],
    country: values[1].country,
    name: values[1].name,
  }));

  const [failed, setFailed] = useState(false);

  const [email, setEmail] = usePersistedState('loginEmail', '');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState('');
  const [showServerTooltip, setShowServerTooltip] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const registrationEnabled = useSelector((state) => state.session.server.registration);
  const languageEnabled = useSelector((state) => {
    const attributes = state.session.server.attributes;
    return !attributes.language && !attributes['ui.disableLoginLanguage'];
  });
  const changeEnabled = useSelector((state) => !state.session.server.attributes.disableChange);
  const emailEnabled = useSelector((state) => state.session.server.emailEnabled);
  const openIdEnabled = useSelector((state) => state.session.server.openIdEnabled);
  const openIdForced = useSelector(
    (state) => state.session.server.openIdEnabled && state.session.server.openIdForce,
  );
  const [codeEnabled, setCodeEnabled] = useState(false);

  const [announcementShown, setAnnouncementShown] = useState(false);
  const announcement = useSelector((state) => state.session.server.announcement);

  const handlePasswordLogin = useCatch(async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      setFailed(false);
      const query = `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
      const response = await fetch('api/session', {
        method: 'POST',
        body: new URLSearchParams(code.length ? `${query}&code=${code}` : query),
      });
      if (response.ok) {
        const user = await response.json();
        generateLoginToken();
        dispatch(sessionActions.updateUser(user));
        const target = window.sessionStorage.getItem('postLogin') || '/';
        window.sessionStorage.removeItem('postLogin');
        navigate(target, { replace: true });
      } else if (response.status === 401 && response.headers.get('WWW-Authenticate') === 'TOTP') {
        setCodeEnabled(true);
      } else if (response.status === 401) {
        setFailed(true);
        if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          containerRef.current?.animate(shake, { duration: 420, easing: 'ease-out' });
        }
      } else {
        throw Error(await response.text());
      }
    } finally {
      setSubmitting(false);
    }
  });

  const handleTokenLogin = useCatch(async (token) => {
    const response = await fetch(`api/session?token=${encodeURIComponent(token)}`);
    if (response.ok) {
      const user = await response.json();
      dispatch(sessionActions.updateUser(user));
      navigate('/');
    } else if (response.status === 401) {
      nativePostMessage('logout');
    }
  });

  const handleTokenLoginRef = useRef(handleTokenLogin);
  handleTokenLoginRef.current = handleTokenLogin;

  const handleOpenIdLogin = () => {
    document.location = 'api/session/openid/auth';
  };

  useEffect(() => nativePostMessage('authentication'), []);

  useEffect(() => {
    const listener = (token) => handleTokenLoginRef.current(token);
    handleLoginTokenListeners.add(listener);
    return () => handleLoginTokenListeners.delete(listener);
  }, []);

  useEffect(() => {
    if (window.localStorage.getItem('hostname') !== window.location.hostname) {
      window.localStorage.setItem('hostname', window.location.hostname);
      setShowServerTooltip(true);
    }
  }, []);

  return (
    <LoginLayout
      options={
        <div className={classes.options}>
          {nativeEnvironment && changeEnabled && (
            <IconButton
              color="primary"
              className={classes.optionButton}
              onClick={() => navigate('/change-server')}
              aria-label={t('settingsServer')}
            >
              <Tooltip
                title={`${t('settingsServer')}: ${window.location.hostname}`}
                open={showServerTooltip}
                arrow
              >
                <VpnLockIcon />
              </Tooltip>
            </IconButton>
          )}
          {!nativeEnvironment && (
            <IconButton
              color="primary"
              className={classes.optionButton}
              onClick={() => setShowQr(true)}
              aria-label={t('sharedQrCode')}
            >
              <QrCode2Icon />
            </IconButton>
          )}
          {languageEnabled && (
            <FormControl>
              <Select
                value={language}
                onChange={(e) => setLocalLanguage(e.target.value)}
                aria-label={t('loginLanguage')}
              >
                {languageList.map((it) => (
                  <MenuItem key={it.code} value={it.code}>
                    <span className={classes.flag}>
                      <CountryFlag countryCode={it.country} svg alt="" aria-hidden="true" />
                    </span>
                    {it.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </div>
      }
    >
      <div className={classes.container} ref={containerRef}>
        <div className={classes.heading}>
          <Typography variant="h4" className={classes.title}>
            {t('loginWelcome')}
          </Typography>
          <Typography variant="body2" className={classes.subtitle}>
            {t('loginSubtitle')}
          </Typography>
        </div>
        {!!announcement && !announcementShown && (
          <Alert severity="info" onClose={() => setAnnouncementShown(true)}>
            {announcement}
          </Alert>
        )}
        {!openIdForced && (
          <>
            <TextField
              required
              error={failed}
              label={t('userEmail')}
              name="email"
              value={email}
              autoComplete="email"
              autoFocus={!email}
              onChange={(e) => setEmail(e.target.value)}
              helperText={failed && t('loginFailed')}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <MailOutlineRoundedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <PasswordField
              required
              error={failed}
              label={t('userPassword')}
              name="password"
              value={password}
              autoComplete="current-password"
              autoFocus={!!email}
              onChange={(e) => setPassword(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockRoundedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            {codeEnabled && (
              <TextField
                required
                error={failed}
                label={t('loginTotpCode')}
                name="code"
                value={code}
                type="number"
                onChange={(e) => setCode(e.target.value)}
              />
            )}
            <Button
              onClick={handlePasswordLogin}
              type="submit"
              variant="contained"
              color="primary"
              className={classes.cta}
              endIcon={
                theme.direction === 'rtl' ? <ArrowBackRoundedIcon /> : <ArrowForwardRoundedIcon />
              }
              loading={submitting}
              disabled={submitting || !email || !password || (codeEnabled && !code)}
            >
              {t('loginLogin')}
            </Button>
          </>
        )}
        {openIdEnabled && (
          <Button
            onClick={() => handleOpenIdLogin()}
            variant="outlined"
            color="primary"
            size="large"
            disabled={submitting}
          >
            {t('loginOpenId')}
          </Button>
        )}
        {!openIdForced && (
          <div className={classes.extraContainer}>
            {registrationEnabled && (
              <Link
                onClick={() => navigate('/register')}
                className={classes.link}
                underline="hover"
                variant="body2"
              >
                {t('loginRegister')}
              </Link>
            )}
            {emailEnabled && (
              <Link
                onClick={() => navigate('/reset-password')}
                className={classes.link}
                underline="hover"
                variant="body2"
              >
                {t('loginReset')}
              </Link>
            )}
          </div>
        )}
      </div>
      <ServerQrCodeDialog open={showQr} onClose={() => setShowQr(false)} />
    </LoginLayout>
  );
};

export default LoginPage;
