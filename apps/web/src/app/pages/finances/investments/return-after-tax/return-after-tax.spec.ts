import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReturnAfterTax } from './return-after-tax';

function render(taxBasisPoints: number | undefined): ComponentFixture<ReturnAfterTax> {
  TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'en-US' }] });
  const fixture = TestBed.createComponent(ReturnAfterTax);
  fixture.componentRef.setInput('returnPercent', 10);
  fixture.componentRef.setInput('cdiPercent', 8);
  fixture.componentRef.setInput('taxBasisPoints', taxBasisPoints);
  fixture.detectChanges();
  return fixture;
}

function text(fixture: ComponentFixture<ReturnAfterTax>): string {
  return (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('ReturnAfterTax', () => {
  it('shows the return and the CDI before and after the income tax', () => {
    expect(text(render(1500))).toBe(
      'Return: +10.00% before income tax, +8.50% after it (15%). CDI after the same tax: +6.80%.',
    );
  });

  it('says the figures are before income tax when no rate was typed', () => {
    const shown = text(render(undefined));

    expect(shown).toContain('before income tax');
    expect(shown).toContain('Analysis tab');
  });
});
