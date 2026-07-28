import { FormEvent, useEffect, useState } from 'react'
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'

export function SiteLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(
    location.pathname === '/gallery' ? (searchParams.get('q') ?? '') : '',
  )

  useEffect(() => {
    if (location.pathname === '/gallery') {
      setSearch(searchParams.get('q') ?? '')
    }
  }, [location.pathname, searchParams])

  function goToSearch(event?: FormEvent) {
    event?.preventDefault()
    const next =
      location.pathname === '/gallery'
        ? new URLSearchParams(searchParams)
        : new URLSearchParams()
    if (search.trim()) next.set('q', search.trim())
    else next.delete('q')
    navigate(`/gallery${next.size ? `?${next.toString()}` : ''}`)
  }

  function updateSearch(value: string) {
    setSearch(value)
    if (location.pathname === '/gallery') {
      const next = new URLSearchParams(searchParams)
      if (value.trim()) next.set('q', value)
      else next.delete('q')
      navigate(`/gallery${next.size ? `?${next.toString()}` : ''}`, {
        replace: true,
      })
    }
  }

  return (
    <div className="site-shell">
      <header className="topbar">
        <Link className="brand-link" to="/" aria-label="返回 March7ths 旅途首页">
          March7ths
        </Link>
        <form
          className="global-search"
          role="search"
          onSubmit={goToSearch}
        >
          <label className="sr-only" htmlFor="global-search">
            搜索旅途相册
          </label>
          <span aria-hidden="true" className="global-search__icon">
            ⌕
          </span>
          <input
            id="global-search"
            type="search"
            value={search}
            onChange={(event) => updateSearch(event.target.value)}
            placeholder="搜索作品、角色或记忆标签"
          />
        </form>
        <nav className="topbar__nav" aria-label="主要导航">
          <NavLink
            className={({ isActive }) =>
              `nav-button${isActive ? ' nav-button--active' : ''}`
            }
            to="/gallery"
          >
            相册
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              `nav-button${isActive ? ' nav-button--active' : ''}`
            }
            to="/upload"
          >
            投稿
          </NavLink>
        </nav>
      </header>

      <main className="site-content">
        <Outlet />
      </main>

      <footer className="site-footer">
        <span>下一站，也要记得拍照</span>
        <span>© 2026 langonginc</span>
      </footer>
    </div>
  )
}
