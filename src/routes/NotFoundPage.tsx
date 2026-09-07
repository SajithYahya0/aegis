import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage(): ReactElement {
  return (
    <div>
      <h1>Page not found</h1>
      <p>
        <Link to="/">Return to the dashboard</Link>
      </p>
    </div>
  );
}
