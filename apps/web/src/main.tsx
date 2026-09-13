import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { http } from './shared/http/client';
import { installInterceptors } from './shared/http/interceptors';
import { installMockBackend } from './shared/http/mockBackend';
import { store } from './shared/store';
import { ThemeModeProvider } from './shared/ThemeModeProvider';

installMockBackend(http);
installInterceptors(store);

const container = document.getElementById('root');

if (!container) {
  throw new Error('#root is missing from index.html.');
}

createRoot(container).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeModeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeModeProvider>
    </Provider>
  </StrictMode>,
);
