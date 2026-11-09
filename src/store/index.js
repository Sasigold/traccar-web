import { combineReducers, configureStore } from '@reduxjs/toolkit';

import { messagesReducer as messages } from './messages';
import { sessionReducer as session } from './session';
import { devicesReducer as devices } from './devices';
import { eventsReducer as events } from './events';
import { motionReducer as motion } from './motion';
import { geofencesReducer as geofences } from './geofences';
import { groupsReducer as groups } from './groups';
import { driversReducer as drivers } from './drivers';
import { maintenancesReducer as maintenances } from './maintenances';
import { calendarsReducer as calendars } from './calendars';
import { reportsReducer as reports } from './reports';
import { fleetReducer as fleet } from './fleet';
import { commandsReducer as commands } from './commands';
import throttleMiddleware from './throttleMiddleware';

const reducer = combineReducers({
  messages,
  session,
  devices,
  events,
  motion,
  geofences,
  groups,
  drivers,
  maintenances,
  calendars,
  reports,
  fleet,
  commands,
});

export { messagesActions } from './messages';
export { sessionActions } from './session';
export { devicesActions } from './devices';
export { eventsActions } from './events';
export { motionActions } from './motion';
export { geofencesActions } from './geofences';
export { groupsActions } from './groups';
export { driversActions } from './drivers';
export { maintenancesActions } from './maintenances';
export { calendarsActions } from './calendars';
export { reportsActions } from './reports';
export { fleetActions } from './fleet';
export { commandsActions } from './commands';

// A store of the app's shape; tests create their own with a starting state (FND-07).
export const createAppStore = (preloadedState) =>
  configureStore({
    reducer,
    preloadedState,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(throttleMiddleware),
  });

export default createAppStore();
