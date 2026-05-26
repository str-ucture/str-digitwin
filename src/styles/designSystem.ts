export const BUTTON_STYLES = {
  primary: 'px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 active:bg-brand-800 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5',
  secondary: 'px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500 disabled:opacity-50 flex items-center justify-center gap-1.5',
  destructive: 'px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500 flex items-center justify-center gap-1.5',
  success: 'px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 active:bg-green-800 rounded-lg transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500 flex items-center justify-center gap-1.5',
  subtle: 'px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800 rounded-lg transition-colors',
  icon: 'p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors',
  iconDestructive: 'p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors',
  info: 'px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
  successSubtle: 'px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
}

export const INPUT_STYLES = {
  text: 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-colors disabled:opacity-50 disabled:bg-gray-50',
  search: 'pl-9 pr-4 py-2 w-full border border-gray-300 rounded-lg text-sm bg-white placeholder-gray-400 outline-none focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-colors',
  label: 'block text-xs font-medium text-gray-600 mb-1.5',
  textDense: 'px-2.5 py-1.5 border border-gray-300 rounded-md text-xs bg-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-colors disabled:opacity-50 disabled:bg-gray-50',
}

export const BADGE_STYLES = {
  brand: 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700',
  neutral: 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600',
  success: 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700',
  error: 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700',
  warning: 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700',
  info: 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700',
}

export const PANEL_STYLES = {
  card: 'bg-white rounded-xl border border-gray-200 shadow-sm p-5',
  modal: 'relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4',
  modalLarge: 'relative bg-white rounded-2xl border border-gray-150 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col',
}

export const TYPOGRAPHY_STYLES = {
  sectionHeader: 'text-sm font-semibold text-gray-700 uppercase tracking-wide',
  cardHeader: 'text-xs font-semibold text-gray-500 uppercase tracking-wider',
  title: 'text-base font-semibold text-gray-900',
  subtitle: 'text-xs text-gray-500 leading-tight',
  body: 'text-xs text-gray-500 leading-normal',
  label: 'text-xs font-medium text-gray-600',
  mono: 'font-mono text-xs text-gray-800',
}

export const TAB_STYLES = {
  container: 'flex items-center gap-1 bg-gray-100 rounded-lg p-1',
  tabActive: 'px-3 py-1 text-xs font-semibold rounded-md bg-white text-gray-900 shadow-sm transition-all',
  tabInactive: 'px-3 py-1 text-xs font-semibold rounded-md text-gray-500 hover:text-gray-700 transition-all',
  
  // Segmented filters/buttons in Model Viewer
  filterActive: 'px-2.5 py-0.5 text-[11px] font-semibold rounded-md bg-brand-50 text-brand-700 border border-brand-200 whitespace-nowrap min-w-[92px] max-w-[170px] truncate text-center transition-all',
  filterInactive: 'px-2.5 py-0.5 text-[11px] font-medium rounded-md bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200/40 hover:border-gray-250 whitespace-nowrap min-w-[92px] max-w-[170px] truncate text-center transition-all',
  
  filterActiveEmerald: 'px-2.5 py-0.5 text-[11px] font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap min-w-[92px] max-w-[170px] truncate text-center transition-all',
  
  underlineActive: 'py-2 px-1 text-xs font-semibold border-b-2 border-brand-500 text-brand-700 transition-all relative cursor-pointer',
  underlineInactive: 'py-2 px-1 text-xs font-semibold border-b-2 border-transparent text-gray-400 hover:text-gray-600 transition-all relative cursor-pointer',
}

export const TABLE_STYLES = {
  container: 'bg-white rounded-xl border border-gray-200 flex flex-col flex-1 min-h-0 shadow-sm overflow-hidden relative',
  headerRow: 'bg-gray-100 border-b border-gray-150 text-left font-bold text-gray-700 text-xs uppercase tracking-wide',
  headerCell: 'px-4 py-3 font-bold text-gray-700 text-xs uppercase tracking-wide',
  bodyCell: 'px-4 py-3 border-b border-gray-100 text-sm text-gray-600',
  bodyCellDense: 'px-4 py-3 border-b border-gray-100 text-[11px] text-gray-600',
  rowHover: 'hover:bg-gray-50 transition-colors',
}

