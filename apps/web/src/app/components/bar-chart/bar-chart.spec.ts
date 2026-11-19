import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarChart } from './bar-chart';

function render(inputs: { selectable?: boolean; selectedIndex?: number | undefined } = {}): {
  fixture: ComponentFixture<BarChart>;
  picked: number[];
} {
  const fixture = TestBed.createComponent(BarChart);
  fixture.componentRef.setInput('title', 'Gains');
  fixture.componentRef.setInput('labels', ['Sep', 'Oct', 'Nov']);
  fixture.componentRef.setInput('values', [100, -50, 200]);
  fixture.componentRef.setInput('format', (value: number) => String(value));
  fixture.componentRef.setInput('emptyText', 'Nothing');
  fixture.componentRef.setInput('selectable', inputs.selectable ?? false);
  fixture.componentRef.setInput('selectedIndex', inputs.selectedIndex);
  const picked: number[] = [];
  fixture.componentInstance.pick.subscribe((index) => picked.push(index));
  fixture.detectChanges();
  return { fixture, picked };
}

function element(fixture: ComponentFixture<BarChart>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

describe('BarChart', () => {
  it('draws one bar per value, the negative one in the second color', () => {
    const { fixture } = render();

    expect(
      [...element(fixture).querySelectorAll('.bar')].map((bar) =>
        bar.classList.contains('negative'),
      ),
    ).toEqual([false, true, false]);
  });

  it('cannot be picked unless it is selectable', () => {
    const { fixture } = render();

    expect(element(fixture).querySelectorAll('.hit').length).toBe(0);
  });

  it('reports the bar clicked or confirmed with the keyboard', () => {
    const { fixture, picked } = render({ selectable: true });
    const hits = element(fixture).querySelectorAll<SVGRectElement>('.hit');

    hits[1].dispatchEvent(new Event('click'));
    hits[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    hits[0].dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));

    expect(picked).toEqual([1, 2, 0]);
  });

  it('fades the bars that are not the one picked and marks the picked one as pressed', () => {
    const { fixture } = render({ selectable: true, selectedIndex: 1 });

    expect([
      [...element(fixture).querySelectorAll('.bar')].map((bar) => bar.classList.contains('dimmed')),
      [...element(fixture).querySelectorAll('.hit')].map((hit) => hit.getAttribute('aria-pressed')),
    ]).toEqual([
      [true, false, true],
      ['false', 'true', 'false'],
    ]);
  });
});

describe('BarChart: hover', () => {
  it('shows the label and the full value of the bar under the mouse and highlights it', () => {
    const fixture = TestBed.createComponent(BarChart);
    fixture.componentRef.setInput('title', 'Gains');
    fixture.componentRef.setInput('labels', ['Sep', 'Oct', 'Nov']);
    fixture.componentRef.setInput('values', [100, -50, 200]);
    fixture.componentRef.setInput('format', (value: number) => String(value));
    fixture.componentRef.setInput('detailFormat', (value: number) => `R$ ${value},00`);
    fixture.componentRef.setInput('emptyText', 'Nothing');
    fixture.detectChanges();
    const zones = (fixture.nativeElement as HTMLElement).querySelectorAll('.zone');

    zones[2].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect([
      [...element.querySelectorAll('.tooltip-text')].map((text) => text.textContent?.trim()),
      [...element.querySelectorAll('.bar')].map((bar) => bar.classList.contains('hovered')),
    ]).toEqual([
      ['Nov', 'R$ 200,00'],
      [false, false, true],
    ]);
  });

  it('takes the tooltip away when the mouse leaves', () => {
    const fixture = TestBed.createComponent(BarChart);
    fixture.componentRef.setInput('title', 'Gains');
    fixture.componentRef.setInput('labels', ['Sep']);
    fixture.componentRef.setInput('values', [100]);
    fixture.componentRef.setInput('format', (value: number) => String(value));
    fixture.componentRef.setInput('emptyText', 'Nothing');
    fixture.detectChanges();
    const zone = (fixture.nativeElement as HTMLElement).querySelector('.zone')!;

    zone.dispatchEvent(new Event('mouseenter'));
    zone.dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.tooltip')).toBeNull();
  });

  it('shows only some of the labels when there are too many months', () => {
    const fixture = TestBed.createComponent(BarChart);
    const labels = Array.from({ length: 24 }, (_, index) => `jan. de ${index + 10}`);
    fixture.componentRef.setInput('title', 'Gains');
    fixture.componentRef.setInput('labels', labels);
    fixture.componentRef.setInput(
      'values',
      labels.map(() => 10),
    );
    fixture.componentRef.setInput('format', (value: number) => String(value));
    fixture.componentRef.setInput('emptyText', 'Nothing');
    fixture.detectChanges();

    const shown = (fixture.nativeElement as HTMLElement).querySelectorAll('text.axis').length;

    expect(shown).toBeLessThan(24 + 5);
  });
});
