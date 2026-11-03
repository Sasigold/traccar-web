import { alpha } from '@mui/material/styles';

export default {
  MuiUseMediaQuery: {
    defaultProps: {
      noSsr: true,
    },
  },
  MuiCssBaseline: {
    styleOverrides: (theme) => ({
      body: {
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      },
      '*::-webkit-scrollbar': { width: 8, height: 8 },
      '*::-webkit-scrollbar-thumb': {
        backgroundColor: alpha(theme.palette.text.primary, 0.2),
        borderRadius: 8,
      },
      '*::-webkit-scrollbar-track': { background: 'transparent' },
    }),
  },
  MuiPaper: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundImage: 'none',
        ...(theme.palette.mode === 'dark' && {
          border: `1px solid ${theme.palette.divider}`,
        }),
      }),
      elevation3: {
        boxShadow: '0 8px 30px rgba(2, 12, 27, 0.12)',
      },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.palette.background.default,
        borderRadius: 10,
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: theme.palette.divider,
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: alpha(theme.palette.primary.main, 0.5),
        },
      }),
    },
  },
  MuiButton: {
    defaultProps: {
      disableElevation: true,
    },
    styleOverrides: {
      root: {
        borderRadius: 10,
      },
      sizeMedium: {
        height: '42px',
      },
      containedSecondary: ({ theme }) => ({
        color: theme.palette.mode === 'dark' ? '#1a1206' : '#ffffff',
      }),
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: {
        borderRadius: 10,
      },
    },
  },
  MuiFab: {
    styleOverrides: {
      root: {
        boxShadow: '0 8px 24px rgba(2, 12, 27, 0.18)',
      },
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: 10,
        marginInline: theme.spacing(1),
        paddingInline: theme.spacing(1.5),
        width: 'auto',
        '&.Mui-selected': {
          backgroundColor: alpha(theme.palette.primary.main, 0.12),
          boxShadow: `inset 3px 0 0 ${theme.palette.primary.main}`,
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.18),
          },
        },
      }),
    },
  },
  MuiListItemIcon: {
    styleOverrides: {
      root: {
        minWidth: 40,
      },
    },
  },
  MuiAvatar: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.palette.primary.main,
        borderRadius: 12,
      }),
    },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: ({ theme }) => ({
        borderInlineEnd: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
      }),
    },
  },
  MuiAppBar: {
    defaultProps: {
      elevation: 0,
    },
    styleOverrides: {
      root: ({ theme }) => ({
        borderBottom: `1px solid ${theme.palette.divider}`,
      }),
    },
  },
  MuiBottomNavigation: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.palette.background.paper,
      }),
    },
  },
  MuiBottomNavigationAction: {
    styleOverrides: {
      root: ({ theme }) => ({
        '&.Mui-selected': {
          color: theme.palette.primary.main,
        },
      }),
      label: {
        fontWeight: 600,
      },
    },
  },
  MuiTableHead: {
    styleOverrides: {
      root: ({ theme }) => ({
        '& .MuiTableCell-head': {
          fontWeight: 700,
          color: theme.palette.text.secondary,
          backgroundColor: alpha(theme.palette.primary.main, 0.06),
        },
      }),
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderBottomColor: theme.palette.divider,
        '@media print': {
          color: theme.palette.alwaysDark.main,
        },
      }),
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        fontWeight: 600,
      },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 16,
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 16,
      },
    },
  },
  MuiFormControl: {
    defaultProps: {
      size: 'small',
    },
  },
  MuiSnackbar: {
    defaultProps: {
      anchorOrigin: {
        vertical: 'bottom',
        horizontal: 'center',
      },
    },
  },
  MuiTooltip: {
    defaultProps: {
      enterDelay: 500,
      enterNextDelay: 500,
    },
    styleOverrides: {
      tooltip: {
        borderRadius: 8,
        fontWeight: 500,
      },
    },
  },
};
