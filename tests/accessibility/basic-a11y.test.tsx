/**
 * Basic Accessibility Tests
 * Tests core accessibility features and WCAG compliance
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetroUI from '../../src/components/MetroUI';

describe('Basic Accessibility Tests', () => {
  it('should render MetroUI component without crashing', () => {
    const { container } = render(<MetroUI />);
    expect(container).toBeTruthy();
  });

  it('should have proper heading structure', () => {
    render(<MetroUI />);

    // Check for proper heading hierarchy
    const headings = screen.getAllByRole('heading');
    expect(headings.length).toBeGreaterThan(0);

    // Ensure h1 exists
    const h1Elements = headings.filter(heading => heading.tagName === 'H1');
    expect(h1Elements.length).toBeGreaterThanOrEqual(1);
  });

  it('should have proper button accessibility', () => {
    render(<MetroUI />);

    // All buttons should have accessible names (aria-label or title)
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      const hasAccessibleName = button.getAttribute('aria-label') ||
                               button.getAttribute('title') ||
                               button.textContent?.trim();
      expect(hasAccessibleName).toBeTruthy();
    });
  });

  it('should have proper form accessibility', () => {
    render(<MetroUI />);

    // All form inputs should have labels or placeholders
    const inputs = screen.queryAllByRole('textbox');
    inputs.forEach(input => {
      const hasAccessibleName = input.getAttribute('aria-label') ||
                               input.getAttribute('placeholder') ||
                               input.getAttribute('title');
      expect(hasAccessibleName).toBeTruthy();
    });
  });

  it('should have proper focus management', () => {
    render(<MetroUI />);

    // Check that focusable elements exist
    const focusableElements = screen.queryAllByRole('button')
      .concat(screen.queryAllByRole('link'))
      .concat(screen.queryAllByRole('textbox'));

    // Should have some focusable elements
    expect(focusableElements.length).toBeGreaterThan(0);
  });

  it('should support keyboard navigation', () => {
    render(<MetroUI />);

    // Check for skip links or other keyboard navigation aids
    const skipLinks = screen.queryAllByText(/skip to main content/i);
    expect(skipLinks.length).toBeGreaterThan(0);
  });
});
