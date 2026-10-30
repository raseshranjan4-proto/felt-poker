import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Toasts, useRoute } from './components/ui';
import { connect, loadIdentity } from './net';
import Gallery from './screens/Gallery';
import History from './screens/History';
import Lobby from './screens/Lobby';
import SettingsScreen from './screens/Settings';
import TableScreen from './screens/table/TableScreen';
import Welcome from './screens/Welcome';
import './styles.css';

function App() {
  const route = useRoute();
  const [hasId, setHasId] = useState(!!loadIdentity());
  if (!hasId) return <><Welcome onDone={() => setHasId(true)} /><Toasts /></>;

  const table = /^#\/t\/([A-Za-z0-9]{6})/.exec(route);
  let screen;
  if (table) screen = <TableScreen code={table[1].toUpperCase()} />;
  else if (route === '#/bots') screen = <Gallery />;
  else if (route === '#/history') screen = <History />;
  else if (route === '#/settings') screen = <SettingsScreen />;
  else screen = <Lobby />;
  return <>{screen}<Toasts /></>;
}

connect();
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
