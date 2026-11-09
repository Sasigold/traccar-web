import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import StoreRoundedIcon from '@mui/icons-material/StoreRounded';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import SellRoundedIcon from '@mui/icons-material/SellRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import ApiRoundedIcon from '@mui/icons-material/ApiRounded';
import ReceiptRoundedIcon from '@mui/icons-material/ReceiptRounded';

// Sections of the super admin area: the section menu and the command palette.
export const adminSections = [
  {
    id: 'main',
    titleKey: 'adminGroupMain',
    items: [
      {
        id: 'overview',
        titleKey: 'adminOverview',
        icon: DashboardRoundedIcon,
        path: '/admin',
        match: (pathname) => pathname === '/admin',
      },
      {
        id: 'customers',
        titleKey: 'adminCustomers',
        icon: StoreRoundedIcon,
        path: '/admin/customers',
        match: (pathname) => pathname.startsWith('/admin/customer'),
      },
      {
        id: 'devices',
        titleKey: 'adminDevices',
        icon: DnsRoundedIcon,
        path: '/admin/devices',
        match: (pathname) => pathname.startsWith('/admin/device'),
      },
      {
        id: 'users',
        titleKey: 'adminUsers',
        icon: PeopleRoundedIcon,
        path: '/admin/users',
        match: (pathname) => pathname.startsWith('/admin/users'),
      },
      {
        id: 'messaging',
        titleKey: 'messagingTitle',
        icon: ForumRoundedIcon,
        path: '/admin/messaging',
        match: (pathname) => pathname.startsWith('/admin/messaging'),
      },
      {
        id: 'api',
        titleKey: 'adminApi',
        icon: ApiRoundedIcon,
        path: '/admin/api',
        match: (pathname) => pathname.startsWith('/admin/api'),
      },
    ],
  },
  {
    id: 'billing',
    titleKey: 'adminGroupBilling',
    items: [
      {
        id: 'invoices',
        titleKey: 'adminInvoices',
        icon: ReceiptLongRoundedIcon,
        path: '/admin/billing',
        match: (pathname) => pathname.startsWith('/admin/billing'),
      },
      {
        id: 'plans',
        titleKey: 'adminPlans',
        icon: SellRoundedIcon,
        path: '/admin/plans',
        match: (pathname) => pathname.startsWith('/admin/plans'),
      },
      {
        id: 'invoicing',
        titleKey: 'invoicingTitle',
        icon: ReceiptRoundedIcon,
        path: '/admin/invoicing',
        match: (pathname) => pathname.startsWith('/admin/invoicing'),
      },
    ],
  },
];
