import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    expect(screen.getByRole('button', { name: 'Increase Pep' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Increase Pep' }));
    expect(group).toHaveTextContent('2 / 2');

    await user.click(screen.getByRole('button', { name: 'Decrease Pep' }));
    await user.click(screen.getByRole('button', { name: 'Decrease Pep' }));
    expect(group).toHaveTextContent('0 / 2');
    expect(screen.getByRole('button', { name: 'Decrease Pep' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
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
    // Neighbouring panels are rendered (for swiping) but hidden from assistive tech.
    expect(screen.getByText('Panel A').closest('[role="tabpanel"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('renders only the active tab and its neighbours', () => {
    const four = [...tabs, { id: 'd', label: 'Delta', content: <p>Panel D</p> }];
    render(<SwipeTabs label="Test tabs" tabs={four} activeId="a" onChange={() => {}} />);
    expect(screen.getByText('Panel B')).toBeTruthy();
    expect(screen.queryByText('Panel C')).toBeNull();
    // The panel is still there to swipe to.
    expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(4);
  });

  it('a swipe changes the tab once it comes to rest, without scrolling again', () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      const { container, rerender } = render(
        <SwipeTabs label="Test tabs" tabs={tabs} activeId="a" onChange={onChange} />,
      );
      const track = container.querySelector('[role="tabpanel"]')!.parentElement!;
      Object.defineProperty(track, 'clientWidth', { value: 100 });
      const scrollTo = vi.fn();
      track.scrollTo = scrollTo;
      // Mid-swipe, past halfway: nothing changes yet.
      track.scrollLeft = 60;
      fireEvent.scroll(track);
      expect(onChange).not.toHaveBeenCalled();
      track.scrollLeft = 100;
      fireEvent.scroll(track);
      // At rest: the browser says so, or (without `scrollend`) no scroll event for a while.
      if ('onscrollend' in window) fireEvent(track, new Event('scrollend'));
      else vi.advanceTimersByTime(200);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith('b');
      // The parent follows; the track is already there, so it isn't scrolled again.
      rerender(<SwipeTabs label="Test tabs" tabs={tabs} activeId="b" onChange={onChange} />);
      expect(scrollTo).not.toHaveBeenCalled();
      // A tab picked by tapping still slides there.
      rerender(<SwipeTabs label="Test tabs" tabs={tabs} activeId="c" onChange={onChange} />);
      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 200 }));
    } finally {
      vi.useRealTimers();
    }
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

  it('leaves its compositor layer once it has slid in, for crisp text', async () => {
    const user = userEvent.setup();
    render(
      <SheetProvider>
        <Opener />
      </SheetProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const sheet = await screen.findByRole('dialog');
    expect(sheet).toHaveAttribute('data-settled', 'false');
    // jsdom has no AnimationEvent, so React listens for the prefixed name there.
    fireEvent(sheet, new Event('webkitAnimationEnd', { bubbles: true }));
    expect(sheet).toHaveAttribute('data-settled', 'true');
    // Closed and opened again: it slides in again first.
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByRole('dialog')).toHaveAttribute('data-settled', 'false');
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
