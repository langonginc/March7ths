import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from '@/App'
import { SiteLayout } from '@/components/SiteLayout'

function renderApp(initialEntry: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function LocationProbe() {
  const location = useLocation()
  return <output>{`${location.pathname}${location.search}`}</output>
}

describe('site shell', () => {
  it('does not show the header or footer on the home page', () => {
    renderApp('/')
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByText('© 2026 langonginc')).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'March7ths' }),
    ).toBeInTheDocument()
  })

  it('shows the shared header and footer away from home', () => {
    const { container } = renderApp('/upload')
    expect(container.querySelector('.topbar')).toBeInTheDocument()
    expect(screen.getByText('下一站，也要记得拍照')).toBeInTheDocument()
    expect(screen.getByText('© 2026 langonginc')).toBeInTheDocument()
  })

  it('uses the requested upload defaults', async () => {
    const user = userEvent.setup()
    const { container } = renderApp('/upload')
    const fileInput = container.querySelector<HTMLInputElement>(
      'input[type="file"]',
    )
    expect(fileInput).not.toBeNull()
    await user.upload(
      fileInput!,
      new File([new Uint8Array([1, 2, 3])], 'memory.jpg', {
        type: 'image/jpeg',
      }),
    )

    expect(screen.getByDisplayValue('MiHoYo')).toBeInTheDocument()
    expect(
      container.querySelector<HTMLInputElement>('input[type="date"]'),
    ).toBeDisabled()
    expect(screen.getByText('来源链接（可选）')).toBeInTheDocument()
    expect(screen.getByText('详细描述（可选）')).toBeInTheDocument()
  })

  it('asks for rights confirmation once per upload batch', async () => {
    const user = userEvent.setup()
    const { container } = renderApp('/upload')
    const fileInput = container.querySelector<HTMLInputElement>(
      'input[type="file"]',
    )

    await user.upload(fileInput!, [
      new File([new Uint8Array([1])], 'first.jpg', {
        type: 'image/jpeg',
      }),
      new File([new Uint8Array([2])], 'second.jpg', {
        type: 'image/jpeg',
      }),
    ])

    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(
      screen.getByRole('checkbox', {
        name: '我确认本次投稿中的所有图片符合本站非商业展示与下载要求，并理解且承担相应版权责任。',
      }),
    ).toBeInTheDocument()
  })

  it('routes a global search to the gallery without a document reload', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/upload']}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="*" element={<LocationProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const search = screen.getByRole('searchbox', { name: '搜索旅途相册' })
    await user.type(search, '三月七')
    await user.keyboard('{Enter}')
    expect(screen.getByText('/gallery?q=%E4%B8%89%E6%9C%88%E4%B8%83')).toBeInTheDocument()
  })
})
