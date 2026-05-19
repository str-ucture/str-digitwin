import { useTranslation } from 'react-i18next'

export default function LanguageToggle() {
  const { i18n } = useTranslation()
  const currentLang = i18n.language.startsWith('de') ? 'de' : 'en'

  function toggle(lang: 'en' | 'de') {
    i18n.changeLanguage(lang)
  }

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      {(['en', 'de'] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => toggle(lang)}
          className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
            currentLang === lang
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
