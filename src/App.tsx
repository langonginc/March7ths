import { Route, Routes } from 'react-router-dom'
import { SiteLayout } from '@/components/SiteLayout'
import { GalleryDetailPage } from '@/pages/GalleryDetailPage'
import { GalleryPage } from '@/pages/GalleryPage'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { UploadPage } from '@/pages/UploadPage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route element={<SiteLayout />}>
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/gallery/:id" element={<GalleryDetailPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
