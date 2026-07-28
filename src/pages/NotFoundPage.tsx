import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="state-page">
      <p className="section-kicker">404</p>
      <h1>似乎走错了车厢</h1>
      <p>这里没有留下照片，回到相册继续这趟旅途吧。</p>
      <Link className="secondary-button" to="/gallery">
        回到旅途相册
      </Link>
    </section>
  )
}
