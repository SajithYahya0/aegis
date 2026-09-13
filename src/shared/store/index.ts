import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { httpErrorReducer } from '../http/interceptors';
import { authReducer } from './authSlice';
import { claimsReducer } from './claimsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    claims: claimsReducer,
    httpError: httpErrorReducer,
  },
});

export type AppStore = typeof store;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
