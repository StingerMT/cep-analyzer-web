import { useState, useCallback, useEffect } from 'react'
import en from '../../public/locales/en.json'
import he from '../../public/locales/he.json'

export type Lang = 'en' | 'he'
export const RTL_LANGS: Lang[] = ['he']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Translations = Record<string, any>
const LOCALES: Record<Lang, Translations> = { en, he }

function resolve(obj: Translations, path: string): string {
  const parts = path.split('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return path
    cur = cur[p]
  }
  return typeof cur === 'string' ? cur : path
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str
  return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))
}

export interface I18nHook {
  lang: Lang
  isRTL: boolean
  setLang: (l: Lang) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const STORAGE_KEY = 'cep_lang'

export function useI18n(): I18nHook {
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem(STORAGE_KEY) as Lang) ?? 'en'
  )

  useEffect(() => {
    document.documentElement.dir  = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(STORAGE_KEY, l)
    setLangState(l)
  }, [])

  const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
    return interpolate(resolve(LOCALES[lang], key), vars)
  }, [lang])

  return { lang, isRTL: RTL_LANGS.includes(lang), setLang, t }
}