import { render, screen } from '@testing-library/react';
import App from './App';

test('renders auth or chat', () => {
  render(<App />);
  const heading = screen.getByText(/chat/i);
  expect(heading).toBeInTheDocument();
});
