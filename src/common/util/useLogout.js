// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { sessionActions } from '../../store';
import { nativePostMessage } from '../components/NativeInterface';
import { clearFleetSession } from '../fleet/session';
import queryClient from '../data/queryClient';
import { clearImpersonation } from './impersonation';

export default () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.session.user);

  return useCallback(async () => {
    const notificationToken = window.localStorage.getItem('notificationToken');
    if (notificationToken && user && !user.readonly) {
      window.localStorage.removeItem('notificationToken');
      const tokens = user.attributes.notificationTokens?.split(',') || [];
      if (tokens.includes(notificationToken)) {
        const updatedUser = {
          ...user,
          attributes: {
            ...user.attributes,
            notificationTokens:
              tokens.length > 1
                ? tokens.filter((it) => it !== notificationToken).join(',')
                : undefined,
          },
        };
        await fetch(`api/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedUser),
        });
      }
    }

    clearFleetSession();
    // ARC-06: nothing of this user stays in the cache for the next one.
    queryClient.clear();
    clearImpersonation();
    await fetch('api/session', { method: 'DELETE' });
    nativePostMessage('logout');
    dispatch(sessionActions.updateUser(null));
    // A full reload drops everything the previous user loaded (devices, positions, events, the
    // dashboard cache), so the next person on a shared PC starts clean.
    if (typeof window !== 'undefined' && window.location?.replace) {
      window.location.replace(new URL('login', document.baseURI).href);
    } else {
      navigate('/login');
    }
  }, [user, navigate, dispatch]);
};
