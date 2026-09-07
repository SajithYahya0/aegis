import { type ReactElement } from 'react';
import { Outlet } from 'react-router-dom';
import { ConnectivityBanner } from '../components/ConnectivityBanner';
import { LabPanel } from '../labs';
import { AppShell } from './AppShell';

export function AppLayout(): ReactElement {
  return (
    <AppShell>
      <ConnectivityBanner />
      <Outlet />
      {import.meta.env.DEV ? <LabPanel /> : null}
    </AppShell>
  );
}
