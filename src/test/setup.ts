import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'scrollTo', {
    value: () => undefined,
    writable: true,
  })
  Object.defineProperty(URL, 'createObjectURL', {
    value: () => 'blob:march7ths-test',
    writable: true,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: () => undefined,
    writable: true,
  })
}
