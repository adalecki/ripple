import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import Combinator from '../Combinator';
import { PreferencesProvider } from '../../../hooks/usePreferences';

// PlateViewCanvas draws to a real canvas, which jsdom does not implement
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
    clearRect: jest.fn(), fillRect: jest.fn(), strokeRect: jest.fn(), beginPath: jest.fn(),
    moveTo: jest.fn(), lineTo: jest.fn(), arc: jest.fn(), fill: jest.fn(), stroke: jest.fn(),
    closePath: jest.fn(), save: jest.fn(), restore: jest.fn(), scale: jest.fn(), translate: jest.fn(),
    setTransform: jest.fn(), clip: jest.fn(), rect: jest.fn(), measureText: jest.fn(() => ({ width: 0 })),
    fillText: jest.fn()
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

function renderCombinator() {
  return render(
    <PreferencesProvider>
      <Combinator />
    </PreferencesProvider>
  );
}

describe('Combinator designer smoke test', () => {
  test('renders the Recipes tab with a seeded recipe', () => {
    renderCombinator();
    expect(screen.getByRole('tab', { name: 'Recipes' })).toBeInTheDocument();
    expect(screen.getByText('Recipe 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply to Wells' })).toBeInTheDocument();
  });

  test('every tab renders without crashing', () => {
    renderCombinator();
    for (const name of ['Inventory', 'Combinations', 'Build', 'Instructions', 'Recipes']) {
      fireEvent.click(screen.getByRole('tab', { name }));
      expect(screen.getByRole('tab', { name, selected: true })).toBeInTheDocument();
    }
  });

  test('Apply is blocked until a region is selected, and says why', () => {
    renderCombinator();
    const apply = screen.getByRole('button', { name: 'Apply to Wells' });
    expect(apply).toBeDisabled();
    fireEvent.mouseEnter(apply.parentElement!);
    expect(screen.getByText(/Save the recipe before applying/)).toBeInTheDocument();
  });

  test('Build is blocked on an empty design and lists the reasons', () => {
    renderCombinator();
    fireEvent.click(screen.getByRole('tab', { name: 'Build' }));
    // nothing authored yet, so the summary card is hidden entirely
    expect(screen.queryByText('Design Summary')).not.toBeInTheDocument();
  });

  // Tabs use mountOnEnter, so every visited pane stays in the DOM - scope queries to the active one
  function activePane() {
    return within(document.querySelector('.tab-pane.active') as HTMLElement);
  }

  test('the inventory form accepts a content and volume', () => {
    renderCombinator();

    fireEvent.click(screen.getByRole('tab', { name: 'Inventory' }));
    const pane = activePane();
    fireEvent.change(pane.getByLabelText(/Well Volume/), { target: { value: '50' } });
    fireEvent.change(pane.getByLabelText(/^Content$/), { target: { value: 'Comp1' } });

    // no wells selected yet, so applying is still blocked and says so
    const apply = pane.getByRole('button', { name: 'Apply to Wells' });
    expect(apply).toBeDisabled();
    fireEvent.mouseEnter(apply.parentElement!);
    expect(screen.getByText('No wells selected')).toBeInTheDocument();
  });

  test('the substitution generator is present and gated', () => {
    renderCombinator();
    fireEvent.click(screen.getByRole('tab', { name: 'Combinations' }));
    const pane = activePane();

    expect(pane.getByText('Substitution Generator')).toBeInTheDocument();
    const generate = pane.getByRole('button', { name: /Generate/ });
    expect(generate).toBeDisabled();
    fireEvent.mouseEnter(generate.parentElement!);
    expect(screen.getByText('Pick a base combination')).toBeInTheDocument();
  });

  test('a combination row can be added', () => {
    renderCombinator();
    fireEvent.click(screen.getByRole('tab', { name: 'Combinations' }));

    fireEvent.click(activePane().getByRole('button', { name: 'Add Combination' }));
    const table = activePane().getByRole('table');
    // header row plus the one combination we just added
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByRole('option', { name: 'Recipe 1' })).toBeInTheDocument();
  });
});
