import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Badge } from './Badge.tsx';
import { SheetProvider } from './BottomSheet.tsx';
import { Counter } from './Counter.tsx';
import { useSheet } from './sheetContext.ts';
import { SwipeTabs } from './SwipeTabs.tsx';

describe('Counter', () => {
  function Harness({ start = 1, max = 3 }: { start?: number; max?: number }) {
    const [value, setValue] = useState(start);
    return <Counter label="Pep" value={value} max={max} onChange={setValue} />;
  }

  it('steps within bounds and disables at the limits', async () => {
    const user = userEvent.setup();
    render(<Harness start={1} max={2} />);
    const group = screen.getByRole('group', { name: 'Pep' });
    expect(group).toHaveTextContent('1 / 2');

    await user.click(screen.getByRole('button', { name: 'Increase Pep' }));
    expect(group).toHaveTextContent('2 / 2');
    expect(screen.getByRole('button', { name: 'Increase Pep' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Decrease Pep' }));
    await user.click(screen.getByRole('button', { name: 'Decrease Pep' }));
    expect(group).toHaveTextContent('0 / 2');
    expect(screen.getByRole('button', { name: 'Decrease Pep' })).toBeDisabled();
  });
});

describe('Badge', () => {
  it('renders its variant', () => {
    render(<Badge variant="override">Overridden</Badge>);
    expect(screen.getByText('Overridden')).toHaveAttribute('data-variant', 'override');
  });
});

describe('SwipeTabs', () => {
  const tabs = [
    { id: 'a', label: 'Alpha', content: <p>Panel A</p> },
    { id: 'b', label: 'Beta', content: <p>Panel B</p> },
    { id: 'c', label: 'Gamma', content: <p>Panel C</p> },
  ];

  it('marks the active tab and its panel', () => {
    render(<SwipeTabs label="Test tabs" tabs={tabs} activeId="b" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Beta' })).toHaveTextContent('Panel B');
    // Inactive panels stay mounted (for swiping) but are hidden from assistive tech.
    expect(screen.getByText('Panel A').closest('[role="tabpanel"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('reports tab clicks and arrow-key navigation', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SwipeTabs label="Test tabs" tabs={tabs} activeId="a" onChange={onChange} />);

    await user.click(screen.getByRole('tab', { name: 'Gamma' }));
    expect(onChange).toHaveBeenLastCalledWith('c');

    screen.getByRole('tab', { name: 'Alpha' }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('c');
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('b');
  });
});

describe('BottomSheet', () => {
  function Opener() {
    const sheet = useSheet();
    return (
      <button
        type="button"
        onClick={() =>
          sheet.open({
            key: 'first',
            title: 'First rule',
            render: () => (
              <button
                type="button"
                onClick={() =>
                  sheet.push({
                    key: 'second',
                    title: 'Second rule',
                    render: () => <p>Linked text</p>,
                  })
                }
              >
                Follow link
              </button>
            ),
          })
        }
      >
        Open
      </button>
    );
  }

  it('opens, follows a link with a back button, goes back, and closes', async () => {
    const user = userEvent.setup();
    render(
      <SheetProvider>
        <Opener />
      </SheetProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByRole('heading', { name: 'First rule' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Back/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Follow link' }));
    expect(await screen.findByRole('heading', { name: 'Second rule' })).toBeInTheDocument();
    expect(screen.getByText('Linked text')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Back/ }));
    expect(await screen.findByRole('heading', { name: 'First rule' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'First rule' })).not.toBeInTheDocument(),
    );
  });

  it('throws a clear error outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Bad() {
      useSheet();
      return null;
    }
    expect(() => render(<Bad />)).toThrow('useSheet must be used inside <SheetProvider>');
  });
});
