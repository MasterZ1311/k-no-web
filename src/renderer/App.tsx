import React from 'react';
import { ErrorBoundary } from './design-system/ErrorBoundary';
import { ToastProvider } from './design-system/ToastProvider';
import { SettingsProvider } from './features/settings/SettingsContext';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { RoomProvider } from './features/rooms/RoomContext';
import { RealtimeProvider } from './features/realtime/RealtimeContext';
import { UnconfiguredView } from './features/auth/UnconfiguredView';
import { AuthContainer } from './features/auth/AuthContainer';
import { AppShell } from './shell/AppShell';
import { LoadingState } from './design-system/LoadingState';

const MainContent: React.FC = () => {
  const { status, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-kano-bg">
        <LoadingState label="Connecting to workspace..." />
      </div>
    );
  }

  if (status && !status.isConfigured) {
    return <UnconfiguredView />;
  }

  if (status && !status.user) {
    return <AuthContainer />;
  }

  return (
    <RoomProvider>
      <RealtimeProvider>
        <AppShell />
      </RealtimeProvider>
    </RoomProvider>
  );
};

export interface AppProps {
  initialStatus?: import('../preload/types').AuthStatus;
}

export const App: React.FC<AppProps> = ({ initialStatus }) => {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <SettingsProvider>
          <AuthProvider initialStatus={initialStatus}>
            <MainContent />
          </AuthProvider>
        </SettingsProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
};

