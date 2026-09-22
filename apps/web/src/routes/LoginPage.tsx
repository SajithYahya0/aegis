import { useState, type FormEvent, type ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../shared/store';
import { loginThunk } from '../shared/store/authSlice';

export default function LoginPage(): ReactElement {
  const dispatch = useAppDispatch();
  const { user, status, error } = useAppSelector((state) => state.auth);
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  if (user) return <Navigate to={from} replace />;

  const onSubmit = (event: FormEvent): void => {
    event.preventDefault();
    void dispatch(loginThunk({ username, password }));
  };

  return (
    <Box sx={{ minHeight: '100%', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper
        component="form"
        onSubmit={onSubmit}
        sx={{ p: 4, width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h1">Sign in to AEGIS</Typography>
        {status === 'error' && <Alert severity="error">{error}</Alert>}
        <TextField label="Username" required value={username} onChange={(e) => setUsername(e.target.value)} />
        <TextField label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" variant="contained" disabled={status === 'loading'}>
          Sign in
        </Button>
        <Typography variant="body2" color="text.secondary">
          Demo: priya / agent123 · arvind / underwriter123
        </Typography>
      </Paper>
    </Box>
  );
}
