// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { YearView } from './year-view'

afterEach(cleanup)

const baseProps = {
  year: 2026,
  entries: [],
  publicHolidays: [],
  schoolHolidays: [],
  showHeatmap: false,
  showPublicHolidays: false,
  showSchoolHolidays: false,
  bridgeDaySet: new Set<string>(),
  bridgeDayMap: new Map(),
  showBridgeDays: false,
  showOtherMonthDays: false,
  overBudgetDates: new Set<string>(),
  selectedType: 'vacation' as const,
}

describe('YearView touch and scroll safety', () => {
  it('aborts mouse drag cleanly on pointercancel without committing a range', () => {
    const onToggle = vi.fn()
    const onSelectRange = vi.fn()
    render(<YearView {...baseProps} onToggle={onToggle} onSelectRange={onSelectRange} />)

    const may1 = screen.getByRole('button', { name: /01\.05\.2026/ })
    const may4 = screen.getByRole('button', { name: /04\.05\.2026/ })

    fireEvent.pointerDown(may1, { button: 0, clientX: 10, clientY: 10, pointerType: 'mouse' })
    fireEvent.pointerEnter(may4)
    fireEvent(document, new Event('pointercancel'))

    expect(onSelectRange).not.toHaveBeenCalled()
  })

  it('never starts range drag selection on touch pointerdown', () => {
    const onToggle = vi.fn()
    const onSelectRange = vi.fn()
    render(<YearView {...baseProps} onToggle={onToggle} onSelectRange={onSelectRange} />)

    const may1 = screen.getByRole('button', { name: /01\.05\.2026/ })
    const may4 = screen.getByRole('button', { name: /04\.05\.2026/ })

    fireEvent.pointerDown(may1, { button: 0, clientX: 10, clientY: 10, pointerType: 'touch' })
    fireEvent.pointerEnter(may4)
    fireEvent(document, new Event('pointerup'))

    expect(onSelectRange).not.toHaveBeenCalled()
  })

  it('suppresses click toggle when pointer moved more than 8px (scroll gesture)', () => {
    const onToggle = vi.fn()
    render(<YearView {...baseProps} onToggle={onToggle} />)

    const may1 = screen.getByRole('button', { name: /01\.05\.2026/ })
    fireEvent.pointerDown(may1, { button: 0, clientX: 20, clientY: 20, pointerType: 'touch' })
    fireEvent.pointerMove(document, { clientX: 20, clientY: 45, pointerType: 'touch' })
    fireEvent.pointerUp(document)
    fireEvent.click(may1)

    expect(onToggle).not.toHaveBeenCalled()
  })

  it('opens day inspection without mutating entries when interactionMode is inspect', () => {
    const onToggle = vi.fn()
    const onSelectDate = vi.fn()
    render(
      <YearView
        {...baseProps}
        interactionMode="inspect"
        onToggle={onToggle}
        onSelectDate={onSelectDate}
      />,
    )

    const may1 = screen.getByRole('button', { name: /01\.05\.2026/ })
    fireEvent.pointerDown(may1, { button: 0, clientX: 20, clientY: 20, pointerType: 'touch' })
    fireEvent.click(may1)

    expect(onToggle).not.toHaveBeenCalled()
    expect(onSelectDate).toHaveBeenCalledTimes(1)
  })

  it('dispatches two-tap range steps without single toggle when interactionMode is range', () => {
    const onToggle = vi.fn()
    const onRangeStep = vi.fn()
    render(
      <YearView
        {...baseProps}
        interactionMode="range"
        onToggle={onToggle}
        onRangeStep={onRangeStep}
      />,
    )

    const may1 = screen.getByRole('button', { name: /01\.05\.2026/ })
    fireEvent.click(may1)

    expect(onToggle).not.toHaveBeenCalled()
    expect(onRangeStep).toHaveBeenCalledWith('2026-05-01')
  })
})
