import { alpha } from '@mui/material/styles';
import { brandColors, navy, radius, shadows } from './tokens';
import { focusRing } from './surfaces';
import { assistantFace } from './fonts';

const tokenShadows = (theme) => shadows[theme.palette.mode];

// True when the server has not overridden the brand primary color.
const brandPrimary = (theme) =>
  [brandColors.navy, brandColors.aqua].includes(theme.palette.primary.main);

const ctaStyles = (theme) => ({
  backgroundColor: theme.palette.cta.main,
  color: theme.palette.cta.contrastText,
  '&:hover': {
    backgroundColor: theme.palette.cta.hover,
  },
});

export default {
  MuiUseMediaQuery: {
    defaultProps: {
      noSsr: true,
    },
  },
  MuiCssBaseline: {
    styleOverrides: (theme) => ({
      '@font-face': assistantFace,
      html: {
        colorScheme: theme.palette.mode,
      },
      body: {
        backgroundColor: theme.palette.background.default,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility',
      },
      '*': {
        scrollbarWidth: 'thin',
        scrollbarColor: `${alpha(theme.palette.text.primary, 0.18)} transparent`,
      },
      '*::-webkit-scrollbar': { width: 10, height: 10 },
      '*::-webkit-scrollbar-thumb': {
        backgroundColor: alpha(theme.palette.text.primary, 0.18),
        borderRadius: radius.pill,
        border: '2px solid transparent',
        backgroundClip: 'content-box',
      },
      '*::-webkit-scrollbar-thumb:hover': {
        backgroundColor: alpha(theme.palette.text.primary, 0.3),
      },
      '*::-webkit-scrollbar-track': { background: 'transparent' },
      '::selection': {
        backgroundColor: alpha(brandColors.aqua, 0.35),
      },
      'html.theme-switching *': {
        transition: 'background-color 200ms ease, color 200ms ease, border-color 200ms ease',
      },
      '@media (prefers-reduced-motion: reduce)': {
        '*, *::before, *::after': {
          animationDuration: '0.01ms !important',
          animationIterationCount: '1 !important',
          transitionDuration: '0.01ms !important',
        },
      },
      '@media print': {
        body: { backgroundColor: brandColors.white },
      },
    }),
  },
  MuiPaper: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundImage: 'none',
        border: `1px solid ${theme.palette.surface.border}`,
      }),
      elevation0: { boxShadow: 'none' },
      elevation1: ({ theme }) => ({ boxShadow: tokenShadows(theme).sm }),
      elevation2: ({ theme }) => ({ boxShadow: tokenShadows(theme).md }),
      elevation3: ({ theme }) => ({ boxShadow: tokenShadows(theme).lg }),
      elevation4: ({ theme }) => ({ boxShadow: tokenShadows(theme).xl }),
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: radius.xl,
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: ({ theme }) => ({
        borderRadius: radius.xl,
        boxShadow: tokenShadows(theme).xl,
        backgroundImage: 'none',
      }),
    },
  },
  MuiBackdrop: {
    styleOverrides: {
      root: {
        backgroundColor: alpha(brandColors.ink, 0.5),
        backdropFilter: 'blur(6px)',
        '&.MuiBackdrop-invisible': {
          backgroundColor: 'transparent',
          backdropFilter: 'none',
        },
      },
    },
  },
  MuiDialogTitle: {
    styleOverrides: {
      root: ({ theme }) => ({
        fontWeight: 700,
        fontSize: '1.125rem',
        padding: theme.spacing(2.5, 3, 1.5),
      }),
    },
  },
  MuiDialogContent: {
    styleOverrides: {
      root: ({ theme }) => ({
        padding: theme.spacing(1, 3, 2),
      }),
    },
  },
  MuiDialogActions: {
    styleOverrides: {
      root: ({ theme }) => ({
        padding: theme.spacing(1.5, 3, 2.5),
        gap: theme.spacing(1),
      }),
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.palette.background.paper,
        borderRadius: radius.md,
        transition: 'box-shadow 160ms ease, border-color 160ms ease',
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: theme.palette.surface.borderStrong,
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: alpha(theme.palette.primary.main, 0.5),
        },
        '&.Mui-focused': {
          boxShadow: focusRing(theme),
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderWidth: 1,
          borderColor: theme.palette.primary.main,
        },
        '&.Mui-disabled': {
          backgroundColor: theme.palette.surface.sunken,
        },
      }),
    },
  },
  MuiInputLabel: {
    styleOverrides: {
      root: {
        fontWeight: 500,
      },
    },
  },
  MuiFormControl: {
    defaultProps: {
      size: 'small',
    },
  },
  MuiTextField: {
    defaultProps: {
      size: 'small',
    },
  },
  MuiFormHelperText: {
    styleOverrides: {
      root: {
        marginInline: 2,
      },
    },
  },
  MuiButton: {
    defaultProps: {
      disableElevation: true,
    },
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: radius.md,
        fontWeight: 600,
        letterSpacing: 0,
        paddingInline: theme.spacing(2),
        transition: 'background-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
        '&:active': {
          transform: 'translateY(1px)',
        },
      }),
      sizeSmall: {
        height: 34,
        fontSize: '0.8125rem',
      },
      sizeMedium: {
        height: 40,
      },
      sizeLarge: {
        height: 48,
        fontSize: '0.9375rem',
      },
      // Main actions are aqua with ink type in both modes (brand book page 06/17).
      // MUI 9 no longer resolves the compound `containedPrimary`/`containedSecondary` keys, so the
      // color is read from ownerState here instead.
      contained: ({ theme, ownerState }) => {
        const color = ownerState?.color ?? 'primary';
        if (color === 'primary') {
          return brandPrimary(theme) ? ctaStyles(theme) : {};
        }
        if (color === 'secondary') {
          return { color: theme.palette.secondary.contrastText };
        }
        return {};
      },
      outlined: ({ theme }) => ({
        borderColor: theme.palette.surface.borderStrong,
        backgroundColor: theme.palette.background.paper,
        '&:hover': {
          borderColor: alpha(theme.palette.primary.main, 0.5),
          backgroundColor: alpha(theme.palette.primary.main, 0.06),
        },
      }),
      text: ({ theme }) => ({
        '&:hover': {
          backgroundColor: alpha(theme.palette.primary.main, 0.08),
        },
      }),
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: radius.md,
        transition: 'background-color 160ms ease, color 160ms ease',
        '&:hover': {
          backgroundColor: alpha(theme.palette.text.primary, 0.06),
        },
      }),
    },
  },
  MuiFab: {
    styleOverrides: {
      root: ({ theme }) => ({
        ...ctaStyles(theme),
        boxShadow: tokenShadows(theme).lg,
      }),
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        position: 'relative',
        borderRadius: radius.md,
        marginInline: theme.spacing(1),
        paddingInline: theme.spacing(1.5),
        width: 'auto',
        transition: 'background-color 140ms ease',
        '&:hover': {
          backgroundColor: alpha(theme.palette.text.primary, 0.05),
        },
        '&.Mui-selected': {
          backgroundColor: theme.palette.surface.tint,
          color: theme.palette.primary.main,
          '& .MuiListItemIcon-root': {
            color: theme.palette.primary.main,
          },
          '& .MuiListItemText-primary': {
            fontWeight: 600,
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            insetInlineStart: 0,
            top: '22%',
            bottom: '22%',
            width: 3,
            borderRadius: 3,
            backgroundColor: theme.palette.primary.main,
          },
          '&:hover': {
            backgroundColor: theme.palette.surface.tint,
          },
        },
      }),
    },
  },
  MuiListItemIcon: {
    styleOverrides: {
      root: ({ theme }) => ({
        minWidth: 40,
        color: theme.palette.text.secondary,
      }),
    },
  },
  MuiListSubheader: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: 'transparent',
        color: theme.palette.text.secondary,
        fontSize: '0.6875rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        lineHeight: '32px',
        paddingInline: theme.spacing(2.5),
      }),
    },
  },
  MuiTabs: {
    styleOverrides: {
      indicator: {
        height: 3,
        borderRadius: 3,
      },
    },
  },
  MuiTab: {
    styleOverrides: {
      root: ({ theme }) => ({
        textTransform: 'none',
        fontWeight: 600,
        minHeight: 44,
        paddingInline: theme.spacing(2),
        '&.Mui-selected': {
          color: theme.palette.primary.main,
        },
      }),
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        fontWeight: 600,
        borderRadius: radius.sm,
      },
    },
  },
  MuiBadge: {
    styleOverrides: {
      badge: {
        fontWeight: 700,
      },
    },
  },
  MuiAvatar: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.palette.mode === 'dark' ? brandColors.aqua : brandColors.navy,
        color: theme.palette.mode === 'dark' ? brandColors.ink : brandColors.aqua,
        fontWeight: 600,
        borderRadius: radius.md,
      }),
    },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: ({ theme }) => ({
        borderInlineEnd: `1px solid ${theme.palette.surface.border}`,
        backgroundColor: theme.palette.background.paper,
        backgroundImage: 'none',
      }),
    },
  },
  MuiAppBar: {
    defaultProps: {
      elevation: 0,
    },
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
        borderBottom: `1px solid ${theme.palette.surface.border}`,
      }),
    },
  },
  MuiBottomNavigation: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.palette.background.paper,
        borderTop: `1px solid ${theme.palette.surface.border}`,
      }),
    },
  },
  MuiBottomNavigationAction: {
    styleOverrides: {
      root: ({ theme }) => ({
        color: theme.palette.text.secondary,
        '&.Mui-selected': {
          color: theme.palette.primary.main,
        },
      }),
      label: {
        fontWeight: 600,
      },
    },
  },
  MuiTableContainer: {
    styleOverrides: {
      root: {
        borderRadius: 'inherit',
      },
    },
  },
  MuiTableHead: {
    styleOverrides: {
      root: ({ theme }) => ({
        '& .MuiTableCell-head': {
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.02em',
          color: theme.palette.text.secondary,
          backgroundColor: theme.palette.surface.sunken,
          borderBottomColor: theme.palette.surface.borderStrong,
          whiteSpace: 'nowrap',
        },
      }),
    },
  },
  MuiTableRow: {
    styleOverrides: {
      root: ({ theme }) => ({
        transition: 'background-color 120ms ease',
        '&.MuiTableRow-hover:hover, tbody &:hover': {
          backgroundColor: alpha(theme.palette.primary.main, 0.04),
        },
      }),
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderBottomColor: theme.palette.surface.border,
        fontSize: '0.875rem',
        '@media print': {
          color: theme.palette.alwaysDark.main,
        },
      }),
    },
  },
  MuiSkeleton: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: alpha(theme.palette.text.primary, 0.08),
        borderRadius: radius.sm,
      }),
    },
  },
  MuiSwitch: {
    styleOverrides: {
      root: {
        padding: 8,
      },
      track: ({ theme }) => ({
        borderRadius: radius.pill,
        backgroundColor: alpha(theme.palette.text.primary, 0.25),
        opacity: 1,
      }),
      thumb: {
        boxShadow: `0 1px 2px ${alpha(brandColors.ink, 0.2)}`,
      },
      switchBase: ({ theme }) =>
        brandPrimary(theme)
          ? {
              '&.Mui-checked': {
                color: brandColors.white,
              },
              '&.Mui-checked + .MuiSwitch-track': {
                backgroundColor: theme.palette.cta.main,
                opacity: 1,
              },
            }
          : {},
    },
  },
  MuiCheckbox: {
    styleOverrides: {
      root: ({ theme }) => ({
        color: theme.palette.text.secondary,
        '& .MuiSvgIcon-root': {
          borderRadius: 6,
        },
      }),
    },
  },
  MuiSnackbar: {
    defaultProps: {
      anchorOrigin: {
        vertical: 'bottom',
        horizontal: 'center',
      },
    },
    styleOverrides: {
      root: ({ theme }) => ({
        [theme.breakpoints.down('md')]: {
          bottom: 'calc(16px + var(--shell-bottom, 0px))',
        },
      }),
    },
  },
  MuiAlert: {
    styleOverrides: {
      root: {
        borderRadius: radius.md,
        fontWeight: 500,
      },
      filled: ({ theme }) => ({
        boxShadow: tokenShadows(theme).lg,
      }),
    },
  },
  MuiTooltip: {
    defaultProps: {
      enterDelay: 400,
      enterNextDelay: 400,
      arrow: true,
    },
    styleOverrides: {
      tooltip: ({ theme }) => ({
        backgroundColor: theme.palette.mode === 'dark' ? navy[700] : brandColors.ink,
        borderRadius: radius.sm,
        fontSize: '0.75rem',
        fontWeight: 500,
        padding: theme.spacing(0.75, 1.25),
      }),
      arrow: ({ theme }) => ({
        color: theme.palette.mode === 'dark' ? navy[700] : brandColors.ink,
      }),
    },
  },
  MuiMenu: {
    styleOverrides: {
      paper: ({ theme }) => ({
        borderRadius: radius.lg,
        border: `1px solid ${theme.palette.surface.border}`,
        boxShadow: tokenShadows(theme).lg,
        backgroundImage: 'none',
      }),
      list: {
        padding: 4,
      },
    },
  },
  MuiPopover: {
    styleOverrides: {
      paper: ({ theme }) => ({
        borderRadius: radius.lg,
        border: `1px solid ${theme.palette.surface.border}`,
        boxShadow: tokenShadows(theme).lg,
        backgroundImage: 'none',
      }),
    },
  },
  MuiMenuItem: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: radius.sm,
        margin: '2px 4px',
        minHeight: 36,
        fontSize: '0.875rem',
        '&.Mui-selected': {
          backgroundColor: theme.palette.surface.tint,
          '&:hover': {
            backgroundColor: theme.palette.surface.tint,
          },
        },
      }),
    },
  },
  MuiAutocomplete: {
    styleOverrides: {
      paper: ({ theme }) => ({
        borderRadius: radius.lg,
        border: `1px solid ${theme.palette.surface.border}`,
        boxShadow: tokenShadows(theme).lg,
      }),
      option: {
        borderRadius: radius.sm,
        margin: '2px 4px',
      },
    },
  },
  MuiDivider: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderColor: theme.palette.surface.border,
      }),
    },
  },
  MuiAccordion: {
    defaultProps: {
      disableGutters: true,
      elevation: 0,
    },
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: radius.lg,
        border: `1px solid ${theme.palette.surface.border}`,
        marginBottom: theme.spacing(1.5),
        '&::before': { display: 'none' },
        '&.Mui-expanded': { margin: `0 0 ${theme.spacing(1.5)}` },
      }),
    },
  },
  MuiSlider: {
    styleOverrides: {
      root: {
        height: 4,
      },
      thumb: ({ theme }) => ({
        width: 16,
        height: 16,
        boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
        '&:hover, &.Mui-focusVisible': {
          boxShadow: `0 0 0 6px ${alpha(theme.palette.primary.main, 0.18)}`,
        },
      }),
      rail: {
        opacity: 0.3,
      },
    },
  },
  MuiLinearProgress: {
    styleOverrides: {
      root: {
        borderRadius: radius.pill,
      },
    },
  },
};
