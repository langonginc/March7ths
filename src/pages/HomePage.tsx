import { useState } from 'react'
import { Link } from 'react-router-dom'
import { assetUrl } from '@/lib/assets'

export function HomePage() {
  const [heroAvailable, setHeroAvailable] = useState(true)

  return (
    <main className="home-page">
      {heroAvailable && (
        <img
          className="home-page__image"
          src={assetUrl('hero.png')}
          alt=""
          aria-hidden="true"
          onError={() => setHeroAvailable(false)}
        />
      )}
      <div className="home-page__veil" aria-hidden="true" />
      <div className="home-page__stars" aria-hidden="true" />
      <section className="home-page__content" aria-labelledby="home-title">
        <p className="home-page__eyebrow">KEEP THE JOURNEY IN EVERY FRAME</p>
        <h1 id="home-title">March7ths</h1>
        <p className="home-page__subtitle">
          把三月七走过的旅途，留在每一帧记忆里
        </p>
        <Link className="primary-cta" to="/gallery">
          <span>翻开旅途相册</span>
          <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  )
}
