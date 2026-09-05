import { notify, state } from './store';

// Compatibility names are notifications only; React owns the application DOM.
export const renderAll = notify;
export const renderAppStructure = notify;
export const renderSidebarLeft = notify;
export const renderSidebarRight = notify;
export const renderMainHeader = notify;
export const renderGrid = notify;
export const renderBatchBar = notify;
export const renderModal = notify;
export const updateCardVisual = (_id: string) => notify();
export function updateTheme() {
  document.documentElement.classList.toggle('dark', state.theme === 'dark');
  notify();
}
