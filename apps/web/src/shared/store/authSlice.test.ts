import {describe, expect, it} from 'vitest';
import {authReducer, logout, type AuthState} from './authSlice';

describe('authSlice', () => {
    it('logout clears both tokens and puts the session back to idle', () => {
        const signedIn: AuthState = {
            ...authReducer(undefined, {type: '@@INIT'}),
            token: 'access-1',
            refreshToken: 'refresh-1',
            status: 'authenticated',
        };

        expect(authReducer(signedIn, logout())).toMatchObject({
            token: null,
            refreshToken: null,
            status: 'idle',
        });
    });
});
