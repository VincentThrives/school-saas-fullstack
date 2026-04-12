import { authHandlers } from './authHandlers';
import { dashboardHandlers } from './dashboardHandlers';
import { coreHandlers } from './coreHandlers';
import { extendedHandlers } from './extendedHandlers';

export const handlers = [
  ...authHandlers,
  ...dashboardHandlers,
  ...coreHandlers,
  ...extendedHandlers,
];

export default handlers;
