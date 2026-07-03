import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { STATUS_CFG, Badge, KpiCard, SectionHead, Card, Topbar } from '../components/shared';

describe('Badge', () => {
  it('renders the correct label for known statuses', () => {
    const { container } = render(<Badge status="delivered" />);
    expect(container.textContent).toBe('Delivered');
  });

  it('renders collected with same styling as delivered', () => {
    expect(STATUS_CFG.collected.bg).toBe(STATUS_CFG.delivered.bg);
    expect(STATUS_CFG.collected.color).toBe(STATUS_CFG.delivered.color);
    const { container } = render(<Badge status="collected" />);
    expect(container.textContent).toBe('Collected');
  });

  it('falls back for unknown status', () => {
    const { container } = render(<Badge status="unknown_xyz" />);
    expect(container.textContent).toBe('unknown_xyz');
  });

  it('renders all known statuses without error', () => {
    const statuses = ['delivered', 'in_transit', 'confirmed', 'loading', 'disputed', 'pending', 'collected', 'open'];
    for (const s of statuses) {
      const { container } = render(<Badge status={s} />);
      expect(container.textContent).toBe(STATUS_CFG[s].label);
    }
  });
});

describe('KpiCard', () => {
  it('renders label and value', () => {
    const { container } = render(<KpiCard label="Total Orders" value="42" />);
    expect(container.textContent).toContain('Total Orders');
    expect(container.textContent).toContain('42');
  });

  it('renders sub text when provided', () => {
    const { container } = render(<KpiCard label="Revenue" value="₦10M" sub="last 30 days" />);
    expect(container.textContent).toContain('last 30 days');
  });
});

describe('SectionHead', () => {
  it('renders title', () => {
    const { container } = render(<SectionHead title="Recent Orders" />);
    expect(container.textContent).toContain('Recent Orders');
  });

  it('renders subtitle when provided', () => {
    const { container } = render(<SectionHead title="Orders" sub="5 total" />);
    expect(container.textContent).toContain('5 total');
  });
});

describe('Card', () => {
  it('renders children', () => {
    const { container } = render(<Card><span>inner content</span></Card>);
    expect(container.textContent).toContain('inner content');
  });
});

describe('Topbar', () => {
  it('renders breadcrumb text', () => {
    const { container } = render(<Topbar crumb="Dashboard" portalLabel="Platform" pills={[]} />);
    expect(container.textContent).toContain('Dashboard');
  });

  it('renders pills', () => {
    const pills = [
      { bg: '#eee', color: '#000', label: 'KYC ✓' },
      { bg: '#eee', color: '#000', label: '₦1.2M' },
    ];
    const { container } = render(<Topbar crumb="Home" portalLabel="Platform" pills={pills} />);
    expect(container.textContent).toContain('KYC ✓');
    expect(container.textContent).toContain('₦1.2M');
  });

  it('shows portal label on mobile', () => {
    const { container } = render(<Topbar crumb="Orders" portalLabel="Buyer Portal" pills={[]} isMobile={true} />);
    expect(container.textContent).toContain('Buyer Portal');
  });
});
