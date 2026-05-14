'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { ChevronDown, X, Check, Search } from 'lucide-react'

export interface ComboboxOption {
  value: string
  label: string
  aliases?: string[]
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
}

interface MultiComboboxProps {
  options: ComboboxOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  maxHeight?: string
}

function matchesSearch(option: ComboboxOption, term: string): boolean {
  const lower = term.toLowerCase()
  if (option.label.toLowerCase().includes(lower)) return true
  if (option.value.toLowerCase().includes(lower)) return true
  if (option.aliases) {
    return option.aliases.some(a => a.toLowerCase().includes(lower))
  }
  return false
}

export function Combobox({
  options, value, onChange, placeholder = 'Auswählen...',
  searchPlaceholder = 'Suchen...', emptyText = 'Keine Ergebnisse',
  className = '',
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [highlightIndex, setHighlightIndex] = useState(-1)

  const filtered = useMemo(() => {
    if (!search) return options
    return options.filter(o => matchesSearch(o, search))
  }, [options, search])

  const selectedLabel = useMemo(() => {
    const found = options.find(o => o.value === value)
    return found?.label ?? ''
  }, [options, value])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  useEffect(() => { setHighlightIndex(-1) }, [search])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setSearch('')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex(prev => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && highlightIndex >= 0 && highlightIndex < filtered.length) {
      e.preventDefault()
      onChange(filtered[highlightIndex].value)
      setOpen(false)
      setSearch('')
    }
  }, [open, filtered, highlightIndex, onChange])

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-combobox-item]')
      items[highlightIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIndex])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onKeyDown={handleKeyDown}
        className="flex min-h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm transition-colors touch-manipulation hover:bg-muted/50"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={value ? 'min-w-0 truncate' : 'min-w-0 truncate text-muted-foreground'}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
          <div className="flex min-h-11 items-center border-b px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 opacity-50 mr-1.5" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button onClick={() => setSearch('')} className="inline-flex h-8 w-8 items-center justify-center opacity-50 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div ref={listRef} className="max-h-[min(18rem,calc(100svh-12rem))] overflow-y-auto p-1" role="listbox">
            {filtered.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground text-center">{emptyText}</div>
            ) : (
              filtered.map((option, idx) => (
                <button
                  key={option.value}
                  data-combobox-item
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                    setSearch('')
                  }}
                  className={`flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm transition-colors ${
                    idx === highlightIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
                  }`}
                >
                  <Check className={`h-3.5 w-3.5 shrink-0 ${option.value === value ? 'opacity-100' : 'opacity-0'}`} />
                  <span className="min-w-0 truncate">{option.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function MultiCombobox({
  options, value, onChange, placeholder = 'Auswählen...',
  searchPlaceholder = 'Suchen...', emptyText = 'Keine Ergebnisse',
  className = '', maxHeight = 'max-h-[min(18rem,calc(100svh-12rem))]',
}: MultiComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    if (!search) return options
    return options.filter(o => matchesSearch(o, search))
  }, [options, search])

  const selectedLabels = useMemo(() => {
    return value.map(v => options.find(o => o.value === v)?.label ?? v)
  }, [options, value])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  const toggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm transition-colors touch-manipulation hover:bg-muted/50"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {value.length === 0 ? (
          <span className="min-w-0 truncate text-muted-foreground">{placeholder}</span>
        ) : (
          <span className="min-w-0 truncate">{value.length} ausgewählt</span>
        )}
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selectedLabels.map((label, i) => (
            <span
              key={value[i]}
              className="inline-flex min-h-8 max-w-full cursor-pointer items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs font-medium transition-colors hover:bg-secondary/80"
              onClick={() => toggle(value[i])}
            >
              <span className="min-w-0 truncate">{label}</span>
              <X className="h-2.5 w-2.5" />
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
          <div className="flex min-h-11 items-center border-b px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 opacity-50 mr-1.5" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button onClick={() => setSearch('')} className="inline-flex h-8 w-8 items-center justify-center opacity-50 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className={`${maxHeight} overflow-y-auto p-1`} role="listbox" aria-multiselectable="true">
            {filtered.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground text-center">{emptyText}</div>
            ) : (
              <>
              <button
                type="button"
                onClick={() => {
                  const allFilteredValues = filtered.map(o => o.value)
                  const allSelected = allFilteredValues.every(v => value.includes(v))
                  if (allSelected) {
                    onChange(value.filter(v => !allFilteredValues.includes(v)))
                  } else {
                    const merged = [...new Set([...value, ...allFilteredValues])]
                    onChange(merged)
                  }
                }}
                className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-sm border-b border-input px-2 py-2 text-sm font-medium transition-colors hover:bg-muted/50 mb-1"
              >
                <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  filtered.every(o => value.includes(o.value)) ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
                }`}>
                  {filtered.every(o => value.includes(o.value)) && <Check className="h-3 w-3" />}
                </div>
                <span>Alles auswählen</span>
              </button>
              {filtered.map(option => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={value.includes(option.value)}
                  onClick={() => toggle(option.value)}
                  className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm transition-colors hover:bg-muted/50"
                >
                  <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    value.includes(option.value) ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
                  }`}>
                    {value.includes(option.value) && <Check className="h-3 w-3" />}
                  </div>
                  <span className="min-w-0 truncate">{option.label}</span>
                </button>
              ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
