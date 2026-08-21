// Cloudflare Pages Functions type declarations
interface Env {
  GH_PUBLIC_TOKEN?: string
}

interface PagesFunction<EnvType = Env> {
  (context: {
    request: Request
    env: EnvType
    params: Record<string, string>
    waitUntil: (promise: Promise<any>) => void
    next: () => Promise<Response>
    data: Record<string, any>
  }): Response | Promise<Response>
}

declare const onRequestGet: PagesFunction
declare const onRequestPost: PagesFunction
declare const onRequestPut: PagesFunction
declare const onRequestDelete: PagesFunction
declare const onRequestPatch: PagesFunction
declare const onRequestHead: PagesFunction
declare const onRequestOptions: PagesFunction
