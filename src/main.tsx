import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { store } from './shared/store';
import { QuoteProvider } from './shared/store/QuoteContext';
import { ThemeModeProvider } from './shared/theme/ThemeModeProvider';
import './styles/global.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('#root is missing from index.html — nothing can be mounted.');
}

createRoot(container).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeModeProvider>
        <BrowserRouter>
          <QuoteProvider>
            <App />
          </QuoteProvider>
        </BrowserRouter>
      </ThemeModeProvider>
    </Provider>
  </StrictMode>,
);
