import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LineChart } from './line-chart';

function render(): ComponentFixture<LineChart> {
  const fixture = TestBed.createComponent(LineChart);
  fixture.componentRef.setInput('title', 'Value');
  fixture.componentRef.setInput('labels', ['Sep', 'Oct', 'Nov']);
  fixture.componentRef.setInput('series', [
    { name: 'Value', values: [100, 150, 120] },
    { name: 'Applied', values: [100, 100, undefined], dashed: true },
    { name: 'Third', values: [50, 60, 70] },
  ]);
  fixture.componentRef.setInput('format', (value: number) => `${value}`);
  fixture.componentRef.setInput('detailFormat', (value: number) => `R$ ${value},00`);
  fixture.componentRef.setInput('emptyText', 'Nothing');
  fixture.detectChanges();
  return fixture;
}

function element(fixture: ComponentFixture<LineChart>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

describe('LineChart: hover', () => {
  it('lists the month and the full value of each line that has one', () => {
    const fixture = render();

    element(fixture).querySelectorAll('.zone')[1].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();

    expect(
      [...element(fixture).querySelectorAll('.tooltip-text')].map((text) =>
        text.textContent?.trim(),
      ),
    ).toEqual(['Oct', 'Value: R$ 150,00', 'Applied: R$ 100,00', 'Third: R$ 60,00']);
  });

  it('marks the point of each line on the month and leaves out the lines with no value there', () => {
    const fixture = render();

    element(fixture).querySelectorAll('.zone')[2].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();

    expect(element(fixture).querySelectorAll('.marker').length).toBe(2);
  });

  it('shows nothing extra until the mouse is over a month', () => {
    const fixture = render();

    expect([
      element(fixture).querySelector('.tooltip'),
      element(fixture).querySelector('.guide'),
    ]).toEqual([null, null]);
  });

  it('gives a line past the second a color of its own', () => {
    const fixture = render();

    expect(element(fixture).querySelector('.line[data-series="2"]')).not.toBeNull();
  });
});
