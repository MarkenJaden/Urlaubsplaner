// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ShareDialog } from './share-dialog'
import type { SharedPlanOverlay } from '@/types'

describe('ShareDialog overlay color selection', () => {
  afterEach(cleanup)

  const sampleOverlay: SharedPlanOverlay = {
    id: 'token-abc1234567',
    token: 'abc12345678901234567890',
    label: 'Plan meiner Freundin',
    color: '#0d9488',
    enabled: true,
    permission: 'view',
    entries: [{ date: '2026-08-10', type: 'vacation' }],
  }

  it('does not show a color picker when creating a share link', () => {
    render(
      <ShareDialog
        open
        onClose={() => {}}
        isLoggedIn={false}
        entries={[]}
        overlays={[sampleOverlay]}
        onToggleOverlay={() => {}}
        onChangeOverlayColor={() => {}}
        onRemoveOverlay={() => {}}
        onAddOverlayByLink={async () => true}
        activeCollabToken={null}
        onSelectCollabToken={() => {}}
      />,
    )

    expect(screen.queryByText('Markierungsfarbe beim Einblenden')).toBeNull()
  })

  it('lets the viewer change the color of an embedded shared plan', () => {
    const onChangeOverlayColor = vi.fn()
    render(
      <ShareDialog
        open
        onClose={() => {}}
        isLoggedIn={false}
        entries={[]}
        overlays={[sampleOverlay]}
        onToggleOverlay={() => {}}
        onChangeOverlayColor={onChangeOverlayColor}
        onRemoveOverlay={() => {}}
        onAddOverlayByLink={async () => true}
        activeCollabToken={null}
        onSelectCollabToken={() => {}}
      />,
    )

    const toggleColorBtn = screen.getByRole('button', { name: 'Farbe für Plan meiner Freundin ändern' })
    fireEvent.click(toggleColorBtn)

    const pinkSwatch = screen.getByRole('button', { name: 'Farbe Pink für Plan meiner Freundin' })
    fireEvent.click(pinkSwatch)
    expect(onChangeOverlayColor).toHaveBeenCalledWith('token-abc1234567', '#ec4899')

    fireEvent.click(toggleColorBtn)
    const customInput = screen.getByLabelText('Eigene Farbe für Plan meiner Freundin')
    fireEvent.change(customInput, { target: { value: '#123456' } })
    expect(onChangeOverlayColor).toHaveBeenCalledWith('token-abc1234567', '#123456')
  })

  it('shows a specific error message when adding an own share link is rejected', async () => {
    render(
      <ShareDialog
        open
        onClose={() => {}}
        isLoggedIn={false}
        entries={[]}
        overlays={[]}
        onToggleOverlay={() => {}}
        onChangeOverlayColor={() => {}}
        onRemoveOverlay={() => {}}
        onAddOverlayByLink={async () => ({
          ok: false,
          error: 'Du kannst deinen eigenen Freigabe-Link nicht als fremden Plan hinzufügen.',
        })}
        activeCollabToken={null}
        onSelectCollabToken={() => {}}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('Geteilten Link hier einfügen…'), {
      target: { value: 'https://example.com/?shareToken=g_myowntoken123456789012' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Einblenden' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('eigenen Freigabe-Link')
  })
})
