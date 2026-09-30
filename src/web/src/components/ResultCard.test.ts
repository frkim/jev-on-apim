import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { ResultCard } from './ResultCard';

describe('ResultCard', () => {
  it('renders noul, choice, and score answers', () => {
    render(React.createElement(React.Fragment, null,
      React.createElement(ResultCard, { id: 'yes', threshold: 0.8, answer: { type: 'noul', noul: 0.91 } }),
      React.createElement(ResultCard, { id: 'route', threshold: 0.8, answer: { type: 'choice', choice: 'billing', probabilities: { billing: 0.8, technical: 0.2 }, confidence: 0.8 } }),
      React.createElement(ResultCard, { id: 'risk', threshold: 0.8, answer: { type: 'score', score: 2.2, legend: { '0': 'low', '1': 'medium', '2': 'high' }, probabilities: { '0': 0.1, '1': 0.2, '2': 0.7 }, confidence: 0.7 } }),
    ));
    expect(screen.getByText('yes')).toBeInTheDocument();
    expect(screen.getByText('billing')).toBeInTheDocument();
    expect(screen.getByText(/Score 2.20/)).toBeInTheDocument();
  });
});
