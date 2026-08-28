import { render, screen } from '@testing-library/react';
import App from './App';

test('renders auth form on initial load', () => {
  render(<App />);
  expect(screen.getByText(/sign up/i)).toBeInTheDocument();
  expect(screen.getByText(/must be a valid @std\.neu\.edu\.tr address/i)).toBeInTheDocument();
});
