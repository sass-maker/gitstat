import type { DetailedHTMLProps, HTMLAttributes } from 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'saas-maker-newsletter-capture': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        'catalog-id'?: string
        'product-name'?: string
        kind?: 'newsletter' | 'waitlist'
        source?: string
        theme?: 'dark' | 'light'
      }
    }
  }
}
