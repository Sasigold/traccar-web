import { useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import SocketController from './SocketController';
import CachingController from './CachingController';
import FleetController from './FleetController';
import FleetAlertsController from './fleet/FleetAlertsController';
import PrivacyController from './fleet/PrivacyController';
import { useCatch, useAsyncTask } from './reactHelper';
import { sessionActions } from './store';
import UpdateController from './UpdateController';
import MotionController from './main/MotionController';
import TermsDialog from './common/components/TermsDialog';
import Loader from './common/components/Loader';
import AppShell from './common/components/shell/AppShell';
import PageErrorBoundary from './common/components/PageErrorBoundary';
import fetchOrThrow, { UNAUTHORIZED_EVENT } from './common/util/fetchOrThrow';

const App = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const newServer = useSelector((state) => state.session.server.newServer);
  const termsUrl = useSelector((state) => state.session.server.attributes.termsUrl);
  const user = useSelector((state) => state.session.user);

  const acceptTerms = useCatch(async () => {
    const response = await fetchOrThrow(`api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...user, attributes: { ...user.attributes, termsAccepted: true } }),
    });
    dispatch(sessionActions.updateUser(await response.json()));
  });

  useAsyncTask(
    async ({ signal }) => {
      if (!user) {
        const response = await fetch('api/session', { signal });
        if (response.ok) {
          dispatch(sessionActions.updateUser(await response.json()));
        } else {
          window.sessionStorage.setItem('postLogin', location.pathname + location.search);
          navigate(newServer ? '/register' : '/login', { replace: true });
        }
      }
      return null;
    },
    [user, dispatch, navigate, newServer, location.pathname, location.search],
  );

  // A request was refused as unauthorized: if the session itself is gone, sign out, and the
  // check above sends the user to the login screen (and back here after signing in).
  useEffect(() => {
    let checking = false;
    const onUnauthorized = async () => {
      if (checking) {
        return;
      }
      checking = true;
      try {
        const response = await fetch('api/session');
        if (response.status === 401) {
          dispatch(sessionActions.updateUser(null));
        }
      } catch {
        // Offline: the connection status says so; keep the session.
      } finally {
        checking = false;
      }
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [dispatch]);

  if (user == null) {
    return <Loader />;
  }
  // A share link (for example a customer tracking link) signs in a temporary user: it gets the
  // live map of the shared vehicle and nothing else.
  if (user.temporary && location.pathname !== '/') {
    return <Navigate to="/" replace />;
  }
  if (termsUrl && !user.attributes.termsAccepted) {
    return <TermsDialog open onCancel={() => navigate('/login')} onAccept={() => acceptTerms()} />;
  }
  return (
    <>
      <SocketController />
      <CachingController />
      <FleetController />
      <FleetAlertsController />
      <PrivacyController />
      <UpdateController />
      <MotionController />
      <AppShell>
        <PageErrorBoundary>
          <Outlet />
        </PageErrorBoundary>
      </AppShell>
    </>
  );
};

export default App;
