import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { http } from '../shared/http/client';
import { installInterceptors } from '../shared/http/interceptors';
import { installMockBackend } from '../shared/http/mockBackend';
import { store } from '../shared/store';
import PoliciesPage from './PoliciesPage';

installMockBackend(http);
installInterceptors(store);

function renderAt(url: string) {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[url]}>
        <PoliciesPage />
      </MemoryRouter>
    </Provider>,
  );
}

describe('PoliciesPage', () => {
  it('lists the book returned by the server', async () => {
    renderAt('/policies');

    await waitFor(() => expect(screen.getByText('POL-1001')).toBeTruthy());
    expect(screen.getByText('Priya Nair')).toBeTruthy();
  });

  it('asks the server for only the status named in the URL', async () => {
    renderAt('/policies?status=lapsed');

    await waitFor(() => expect(screen.getByText('POL-1005')).toBeTruthy());
    expect(screen.queryByText('POL-1001')).toBeNull();
  });
});
