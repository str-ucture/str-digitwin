import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/authContext'
import LanguageToggle from './LanguageToggle'

export default function Header() {
  const { t } = useTranslation()
  const session = useSession()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  async function handleSignOut() {
    setDropdownOpen(false)
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  const initial = session?.user?.email ? session.user.email.charAt(0).toUpperCase() : 'U'

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-100 shadow-sm z-10 flex-shrink-0">
      <Link to="/" className="flex items-center gap-3 hover:opacity-85 transition-opacity cursor-pointer">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="Logo" className="h-9 w-auto flex-shrink-0" />
        <div>
          <h1 className="text-base font-semibold text-gray-900 leading-tight">{t('header.title')}</h1>
          {t('header.subtitle') && (
            <p className="text-xs text-gray-500 leading-tight">{t('header.subtitle')}</p>
          )}
        </div>
      </Link>

      <div className="flex items-center gap-3">
        <LanguageToggle />
        {/* Auth is resolved */}
        {session !== undefined && (
          session ? (
            // Logged-in state
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-8 h-8 rounded-full bg-brand-50 border border-brand-200 text-brand-700 font-bold text-xs flex items-center justify-center hover:bg-brand-100 hover:text-brand-800 transition-all shadow-sm focus:outline-none cursor-pointer"
                title={session.user.email}
              >
                {initial}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2.5 w-60 bg-white border border-gray-100 rounded-xl shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <Link
                    to="/admin"
                    onClick={() => setDropdownOpen(false)}
                    className="block px-4 py-2.5 text-xs text-brand-700 hover:bg-brand-50 hover:text-brand-800 transition-colors font-semibold flex items-center gap-2 border-b border-gray-100 cursor-pointer rounded-t-xl"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Admin Console
                  </Link>

                  <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
                    <span className="block text-xs text-gray-700 font-semibold truncate" title={session.user.email}>
                      {session.user.email}
                    </span>
                  </div>
                  
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors font-semibold flex items-center gap-2 cursor-pointer rounded-b-xl"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Logged-out state
            <Link
              to="/login"
              className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              Login
            </Link>
          )
        )}
      </div>
    </header>
  )
}
