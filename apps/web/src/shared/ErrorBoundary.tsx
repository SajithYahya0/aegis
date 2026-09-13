import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';

export interface ErrorBoundaryProps {
  label: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  attempt: number;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null, attempt: 0 };

  static getDerivedStateFromError(thrown: unknown): Partial<ErrorBoundaryState> {
    return { error: thrown instanceof Error ? thrown : new Error(String(thrown)) };
  }

  override componentDidCatch(thrown: unknown, info: ErrorInfo): void {
    console.error(`${this.props.label} failed`, thrown, info.componentStack);
  }

  private retry = (): void => {
    this.setState((previous) => ({ error: null, attempt: previous.attempt + 1 }));
  };

  override render(): ReactNode {
    const { error, attempt } = this.state;
    const { label, children } = this.props;

    if (error) {
      return (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={this.retry}>
              Retry
            </Button>
          }
        >
          <AlertTitle>{label} could not be displayed</AlertTitle>
          {error.message}
        </Alert>
      );
    }

    return <Fragment key={attempt}>{children}</Fragment>;
  }
}
