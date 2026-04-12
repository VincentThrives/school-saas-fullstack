import { createTheme, alpha } from '@mui/material/styles';

// Gold, White & Black color palette
const goldColor = '#D4A843';
const goldLight = '#E8C97A';
const goldDark = '#B8860B';
const blackColor = '#1A1A1A';
const blackLight = '#2D2D2D';
const blackDark = '#0D0D0D';
const whiteColor = '#FFFFFF';
const offWhite = '#FAF8F5';
const warmGray = '#F5F0E8';

const successColor = '#2E7D32';
const warningColor = '#ED6C02';
const errorColor = '#D32F2F';
const infoColor = '#0288D1';

// Create the light theme
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: goldColor,
      light: goldLight,
      dark: goldDark,
      contrastText: blackColor,
    },
    secondary: {
      main: blackColor,
      light: blackLight,
      dark: blackDark,
      contrastText: whiteColor,
    },
    success: {
      main: successColor,
      light: '#4CAF50',
      dark: '#1B5E20',
    },
    warning: {
      main: warningColor,
      light: '#FF9800',
      dark: '#E65100',
    },
    error: {
      main: errorColor,
      light: '#EF5350',
      dark: '#C62828',
    },
    info: {
      main: infoColor,
      light: '#03A9F4',
      dark: '#01579B',
    },
    background: {
      default: offWhite,
      paper: whiteColor,
    },
    text: {
      primary: blackColor,
      secondary: 'rgba(26, 26, 26, 0.65)',
      disabled: 'rgba(26, 26, 26, 0.38)',
    },
    divider: 'rgba(212, 168, 67, 0.15)',
  },
  typography: {
    fontFamily: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 700,
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    subtitle1: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.5,
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.57,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.57,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.66,
    },
    overline: {
      fontSize: '0.75rem',
      fontWeight: 600,
      letterSpacing: '0.5px',
      lineHeight: 2.5,
      textTransform: 'uppercase',
    },
  },
  shape: {
    borderRadius: 10,
  },
  shadows: [
    'none',
    '0px 1px 3px rgba(26, 26, 26, 0.08), 0px 1px 2px rgba(212, 168, 67, 0.04)',
    '0px 2px 6px rgba(26, 26, 26, 0.08), 0px 1px 4px rgba(212, 168, 67, 0.06)',
    '0px 3px 9px rgba(26, 26, 26, 0.08), 0px 2px 6px rgba(212, 168, 67, 0.06)',
    '0px 4px 12px rgba(26, 26, 26, 0.08), 0px 3px 8px rgba(212, 168, 67, 0.06)',
    '0px 5px 15px rgba(26, 26, 26, 0.1), 0px 4px 10px rgba(212, 168, 67, 0.06)',
    '0px 6px 18px rgba(26, 26, 26, 0.1), 0px 5px 12px rgba(212, 168, 67, 0.06)',
    '0px 7px 21px rgba(26, 26, 26, 0.1), 0px 6px 14px rgba(212, 168, 67, 0.08)',
    '0px 8px 24px rgba(26, 26, 26, 0.1), 0px 7px 16px rgba(212, 168, 67, 0.08)',
    '0px 9px 27px rgba(26, 26, 26, 0.1), 0px 8px 18px rgba(212, 168, 67, 0.08)',
    '0px 10px 30px rgba(26, 26, 26, 0.12), 0px 9px 20px rgba(212, 168, 67, 0.08)',
    '0px 11px 33px rgba(26, 26, 26, 0.12), 0px 10px 22px rgba(212, 168, 67, 0.08)',
    '0px 12px 36px rgba(26, 26, 26, 0.12), 0px 11px 24px rgba(212, 168, 67, 0.08)',
    '0px 13px 39px rgba(26, 26, 26, 0.12), 0px 12px 26px rgba(212, 168, 67, 0.08)',
    '0px 14px 42px rgba(26, 26, 26, 0.12), 0px 13px 28px rgba(212, 168, 67, 0.08)',
    '0px 15px 45px rgba(26, 26, 26, 0.12), 0px 14px 30px rgba(212, 168, 67, 0.08)',
    '0px 16px 48px rgba(26, 26, 26, 0.14), 0px 15px 32px rgba(212, 168, 67, 0.1)',
    '0px 17px 51px rgba(26, 26, 26, 0.14), 0px 16px 34px rgba(212, 168, 67, 0.1)',
    '0px 18px 54px rgba(26, 26, 26, 0.14), 0px 17px 36px rgba(212, 168, 67, 0.1)',
    '0px 19px 57px rgba(26, 26, 26, 0.14), 0px 18px 38px rgba(212, 168, 67, 0.1)',
    '0px 20px 60px rgba(26, 26, 26, 0.14), 0px 19px 40px rgba(212, 168, 67, 0.1)',
    '0px 21px 63px rgba(26, 26, 26, 0.16), 0px 20px 42px rgba(212, 168, 67, 0.1)',
    '0px 22px 66px rgba(26, 26, 26, 0.16), 0px 21px 44px rgba(212, 168, 67, 0.1)',
    '0px 23px 69px rgba(26, 26, 26, 0.16), 0px 22px 46px rgba(212, 168, 67, 0.1)',
    '0px 24px 72px rgba(26, 26, 26, 0.16), 0px 23px 48px rgba(212, 168, 67, 0.1)',
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*': {
          boxSizing: 'border-box',
        },
        html: {
          MozOsxFontSmoothing: 'grayscale',
          WebkitFontSmoothing: 'antialiased',
          height: '100%',
          width: '100%',
        },
        body: {
          height: '100%',
          width: '100%',
        },
        '#root': {
          height: '100%',
          width: '100%',
        },
        '::-webkit-scrollbar': {
          width: '8px',
          height: '8px',
        },
        '::-webkit-scrollbar-track': {
          background: warmGray,
        },
        '::-webkit-scrollbar-thumb': {
          background: alpha(goldColor, 0.4),
          borderRadius: '4px',
        },
        '::-webkit-scrollbar-thumb:hover': {
          background: alpha(goldColor, 0.6),
        },
        '@keyframes shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        '@keyframes fadeInUp': {
          from: { opacity: 0, transform: 'translateY(20px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        '@keyframes pulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.7 },
        },
        '@keyframes goldGlow': {
          '0%, 100%': { boxShadow: `0 0 5px ${alpha(goldColor, 0.3)}` },
          '50%': { boxShadow: `0 0 20px ${alpha(goldColor, 0.5)}, 0 0 40px ${alpha(goldColor, 0.2)}` },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '8px 20px',
          fontWeight: 600,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        contained: {
          boxShadow: `0px 2px 8px ${alpha(goldColor, 0.3)}`,
          '&:hover': {
            boxShadow: `0px 4px 16px ${alpha(goldColor, 0.4)}`,
          },
        },
        containedPrimary: {
          background: `linear-gradient(135deg, ${goldColor} 0%, ${goldDark} 100%)`,
          color: whiteColor,
          '&:hover': {
            background: `linear-gradient(135deg, ${goldLight} 0%, ${goldColor} 100%)`,
          },
        },
        containedSecondary: {
          background: `linear-gradient(135deg, ${blackLight} 0%, ${blackDark} 100%)`,
          '&:hover': {
            background: `linear-gradient(135deg, ${blackColor} 0%, ${blackLight} 100%)`,
          },
        },
        outlined: {
          borderWidth: 2,
          '&:hover': {
            borderWidth: 2,
            backgroundColor: alpha(goldColor, 0.06),
          },
        },
        outlinedPrimary: {
          borderColor: goldColor,
          color: goldDark,
          '&:hover': {
            borderColor: goldDark,
          },
        },
        sizeSmall: {
          padding: '6px 14px',
          fontSize: '0.8125rem',
        },
        sizeLarge: {
          padding: '12px 28px',
          fontSize: '1rem',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          border: `1px solid ${alpha(goldColor, 0.1)}`,
          boxShadow: `0px 2px 8px ${alpha(blackColor, 0.04)}, 0px 1px 4px ${alpha(goldColor, 0.06)}`,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: `0px 8px 24px ${alpha(blackColor, 0.08)}, 0px 4px 12px ${alpha(goldColor, 0.1)}`,
            borderColor: alpha(goldColor, 0.25),
          },
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: {
          padding: '16px 20px',
        },
        title: {
          fontSize: '1rem',
          fontWeight: 600,
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '16px 20px',
          '&:last-child': {
            paddingBottom: '20px',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        rounded: {
          borderRadius: 14,
        },
        elevation1: {
          boxShadow: `0px 2px 8px ${alpha(blackColor, 0.04)}, 0px 1px 4px ${alpha(goldColor, 0.06)}`,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            transition: 'all 0.2s ease',
            '&.Mui-focused': {
              boxShadow: `0 0 0 3px ${alpha(goldColor, 0.15)}`,
            },
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: goldColor,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: goldColor,
            borderWidth: 2,
          },
        },
        notchedOutline: {
          borderColor: alpha(blackColor, 0.15),
          transition: 'border-color 0.2s ease',
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          '&.Mui-focused': {
            color: goldDark,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          borderRadius: 8,
        },
        filled: {
          '&.MuiChip-colorPrimary': {
            backgroundColor: alpha(goldColor, 0.12),
            color: goldDark,
          },
          '&.MuiChip-colorSuccess': {
            backgroundColor: alpha(successColor, 0.12),
            color: successColor,
          },
          '&.MuiChip-colorWarning': {
            backgroundColor: alpha(warningColor, 0.12),
            color: warningColor,
          },
          '&.MuiChip-colorError': {
            backgroundColor: alpha(errorColor, 0.12),
            color: errorColor,
          },
          '&.MuiChip-colorInfo': {
            backgroundColor: alpha(infoColor, 0.12),
            color: infoColor,
          },
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            fontWeight: 600,
            backgroundColor: alpha(goldColor, 0.06),
            borderBottom: `2px solid ${alpha(goldColor, 0.2)}`,
            color: blackColor,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '12px 16px',
          borderBottom: `1px solid ${alpha(goldColor, 0.08)}`,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.2s ease',
          '&:hover': {
            backgroundColor: alpha(goldColor, 0.04),
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 18,
          border: `1px solid ${alpha(goldColor, 0.15)}`,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '1.25rem',
          fontWeight: 600,
          padding: '20px 24px 12px',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '12px 24px 20px',
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '12px 24px 20px',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: 'none',
          backgroundColor: blackDark,
          color: whiteColor,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          marginBottom: 4,
          transition: 'all 0.2s ease',
          '&.Mui-selected': {
            backgroundColor: alpha(goldColor, 0.15),
            color: goldColor,
            '&:hover': {
              backgroundColor: alpha(goldColor, 0.2),
            },
          },
          '&:hover': {
            backgroundColor: alpha(whiteColor, 0.08),
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: 40,
          color: 'inherit',
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
        colorDefault: {
          backgroundColor: goldColor,
          color: blackColor,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
        standardSuccess: {
          backgroundColor: alpha(successColor, 0.1),
          color: successColor,
        },
        standardWarning: {
          backgroundColor: alpha(warningColor, 0.1),
          color: warningColor,
        },
        standardError: {
          backgroundColor: alpha(errorColor, 0.1),
          color: errorColor,
        },
        standardInfo: {
          backgroundColor: alpha(infoColor, 0.1),
          color: infoColor,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: blackColor,
          fontSize: '0.75rem',
          borderRadius: 8,
          padding: '6px 12px',
          border: `1px solid ${alpha(goldColor, 0.2)}`,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: '3px 3px 0 0',
          backgroundColor: goldColor,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          minHeight: 48,
          '&.Mui-selected': {
            color: goldDark,
          },
        },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: {
          fontWeight: 600,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          height: 6,
          backgroundColor: alpha(goldColor, 0.15),
        },
        bar: {
          background: `linear-gradient(90deg, ${goldDark}, ${goldColor}, ${goldLight})`,
          borderRadius: 4,
        },
      },
    },
    MuiCircularProgress: {
      styleOverrides: {
        root: {
          strokeLinecap: 'round',
          color: goldColor,
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        primary: {
          background: `linear-gradient(135deg, ${goldColor} 0%, ${goldDark} 100%)`,
          color: whiteColor,
          '&:hover': {
            background: `linear-gradient(135deg, ${goldLight} 0%, ${goldColor} 100%)`,
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: whiteColor,
          color: blackColor,
        },
      },
    },
  },
});

// Dark theme variant - Black & Gold
export const darkTheme = createTheme({
  ...theme,
  palette: {
    mode: 'dark',
    primary: {
      main: goldColor,
      light: goldLight,
      dark: goldDark,
      contrastText: blackDark,
    },
    secondary: {
      main: '#E0E0E0',
      light: '#F5F5F5',
      dark: '#BDBDBD',
      contrastText: blackDark,
    },
    background: {
      default: '#0A0A0A',
      paper: '#141414',
    },
    text: {
      primary: '#F5F0E8',
      secondary: 'rgba(245, 240, 232, 0.65)',
      disabled: 'rgba(245, 240, 232, 0.38)',
    },
    divider: alpha(goldColor, 0.12),
  },
  components: {
    ...theme.components,
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: 'none',
          backgroundColor: '#0A0A0A',
          color: '#F5F0E8',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#141414',
          color: '#F5F0E8',
        },
      },
    },
  },
});

export default theme;
