import { useState, useRef } from 'react'
import Header from '../components/UI/Header'
import AdminHeader from '../components/Admin/AdminHeader'
import ConfirmDialog from '../components/Admin/ConfirmDialog'
import Toast, { useToast } from '../components/Admin/Toast'
import TagInput from '../components/Admin/TagInput'
import LoadingSpinner from '../components/UI/LoadingSpinner'
import {
  BUTTON_STYLES,
  INPUT_STYLES,
  BADGE_STYLES,
  PANEL_STYLES,
  TYPOGRAPHY_STYLES,
  TAB_STYLES,
  TABLE_STYLES,
} from '../styles/designSystem'
import { 
  Palette, 
  MousePointerClick, 
  FormInput, 
  Tag, 
  Layers, 
  HelpCircle,
  FileCode,
  Copy,
  Check,
  Type,
  Table,
} from 'lucide-react'

// Code copy utility helper inside the page
function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  function copyToClipboard() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group mt-2">
      <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto font-mono leading-relaxed max-w-full">
        {code}
      </pre>
      <button
        onClick={copyToClipboard}
        className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
        title="Copy code"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

export default function DesignSystemPage() {
  const { toasts, showToast } = useToast()
  
  // Interactive element states
  const [activeTab, setActiveTab] = useState<'tokens' | 'buttons' | 'inputs' | 'badges' | 'overlays' | 'utilities' | 'typography' | 'tables'>('tokens')
  const [demoTags, setDemoTags] = useState<string[]>(['engineering', '3d-model', 'lod-medium'])
  const [demoTextInput, setDemoTextInput] = useState('')
  const [demoCheckbox, setDemoCheckbox] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogDestructive, setDialogDestructive] = useState(false)

  // Section refs for smooth scrolling if needed, but active tab switching is very clean
  const sections = [
    { id: 'tokens', label: 'Color Tokens & Panels', icon: Palette },
    { id: 'typography', label: 'Typography & Fonts', icon: Type },
    { id: 'buttons', label: 'Buttons & Actions', icon: MousePointerClick },
    { id: 'inputs', label: 'Form Controls & Tag Inputs', icon: FormInput },
    { id: 'badges', label: 'Badges & Labels', icon: Tag },
    { id: 'tables', label: 'Tables & Tab Filters', icon: Table },
    { id: 'overlays', label: 'Modals & Dialog Overlays', icon: Layers },
    { id: 'utilities', label: 'Loaders & Toast Alerts', icon: HelpCircle },
  ] as const

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <Header />
      <AdminHeader activeTab="design-system" />

      {/* Main container split into sidebar and content */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar Navigation */}
        <aside className="w-64 border-r border-gray-200 bg-white flex flex-col justify-between flex-shrink-0">
          <div className="p-4 flex-1 overflow-y-auto space-y-1">
            <div className="px-3 mb-4">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Design System Catalog
              </span>
            </div>
            <nav className="space-y-1">
              {sections.map(section => {
                const Icon = section.icon
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveTab(section.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left ${
                      activeTab === section.id
                        ? 'text-brand-700 bg-brand-50 font-semibold'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${activeTab === section.id ? 'text-brand-600' : 'text-gray-400'}`} />
                    {section.label}
                  </button>
                )
              })}
            </nav>
          </div>
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <p className="text-[10px] text-gray-500 font-medium">
              STR Digital Twin UI framework, powered by unified class mappings.
            </p>
          </div>
        </aside>

        {/* Right Content Area */}
        <main className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Header info card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">STR Digital Twin Style System</h2>
              <p className="text-sm text-gray-500">
                This page documents and demonstrates the visual tokens and reusable components compiled across the twin console. Under the hood, components import unified style mappings to ensure consistent layout, hover micro-animations, and brand alignment.
              </p>
            </div>

            {/* TAB CONTENT: Color Tokens & Panels */}
            {activeTab === 'tokens' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className={PANEL_STYLES.card}>
                  <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
                    <Palette className="w-5 h-5 text-brand-600" />
                    <h3 className="font-bold text-gray-900">Brand Color Palettes</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    The primary brand colors are custom pinks extended in the Tailwind config file under the name <code className="bg-gray-100 px-1 py-0.5 rounded text-red-600">brand</code>.
                  </p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <div className="h-16 rounded-lg bg-brand-600 border border-brand-700 flex items-end p-2 text-white font-bold text-xs shadow-sm">
                        #ff3eb5 (600)
                      </div>
                      <span className="text-xs font-semibold text-gray-700 block">Primary Brand</span>
                      <span className="text-[10px] text-gray-400 block">Main action buttons & highlight states</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="h-16 rounded-lg bg-brand-50 border border-brand-100 flex items-end p-2 text-brand-700 font-bold text-xs">
                        #fff0f9 (50)
                      </div>
                      <span className="text-xs font-semibold text-gray-700 block">Brand Light</span>
                      <span className="text-[10px] text-gray-400 block">Backgrounds for selected rows & badges</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="h-16 rounded-lg bg-brand-700 border border-brand-800 flex items-end p-2 text-white font-bold text-xs shadow-sm">
                        #ff009d (700)
                      </div>
                      <span className="text-xs font-semibold text-gray-700 block">Brand Focus</span>
                      <span className="text-[10px] text-gray-400 block">Hover states for primary links</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="h-16 rounded-lg bg-brand-900 border border-brand-950 flex items-end p-2 text-white font-bold text-xs">
                        #8f0058 (900)
                      </div>
                      <span className="text-xs font-semibold text-gray-700 block">Brand Dark</span>
                      <span className="text-[10px] text-gray-400 block">Footer/drawer text or high contrast areas</span>
                    </div>
                  </div>
                </div>

                <div className={PANEL_STYLES.card}>
                  <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
                    <Palette className="w-5 h-5 text-gray-600" />
                    <h3 className="font-bold text-gray-900">Feedback Colors</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-lg">
                      <span className="w-3 h-3 rounded-full bg-green-600 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-green-900">Success Status</p>
                        <p className="text-[10px] text-green-600">Operations completed successfully</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                      <span className="w-3 h-3 rounded-full bg-red-600 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-red-900">Destructive / Error</p>
                        <p className="text-[10px] text-red-600">Critical failures or deletions</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                      <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-amber-900">Featured / Warning</p>
                        <p className="text-[10px] text-amber-600">Highlighted items or pending info</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={PANEL_STYLES.card}>
                  <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
                    <FileCode className="w-5 h-5 text-gray-600" />
                    <h3 className="font-bold text-gray-900">Unified Panel Styles</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-gray-700">Standard Card Container</span>
                      <div className={PANEL_STYLES.card}>
                        <p className="text-xs text-gray-500">Rendered using <code className="bg-gray-100 px-1 py-0.5 rounded text-brand-600">PANEL_STYLES.card</code></p>
                      </div>
                      <CodeBlock code="className={PANEL_STYLES.card}" />
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-gray-700">Modal Popup Box</span>
                      <div className={PANEL_STYLES.modal}>
                        <p className="text-xs text-gray-500">Rendered using <code className="bg-gray-100 px-1 py-0.5 rounded text-brand-600">PANEL_STYLES.modal</code></p>
                      </div>
                      <CodeBlock code="className={PANEL_STYLES.modal}" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Typography & Fonts */}
            {activeTab === 'typography' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className={PANEL_STYLES.card}>
                  <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
                    <Type className="w-5 h-5 text-brand-600" />
                    <h3 className="font-bold text-gray-900">Typography Styles</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    Visual text hierarchies, headers, and font weights utilized across the console.
                  </p>

                  <div className="space-y-4">
                    {/* sectionHeader */}
                    <div className="p-3 border border-gray-100 rounded-lg">
                      <span className="text-[10px] font-bold text-gray-400 block mb-1">TYPOGRAPHY_STYLES.sectionHeader</span>
                      <h4 className={TYPOGRAPHY_STYLES.sectionHeader}>Section Heading Title</h4>
                    </div>

                    {/* cardHeader */}
                    <div className="p-3 border border-gray-100 rounded-lg">
                      <span className="text-[10px] font-bold text-gray-400 block mb-1">TYPOGRAPHY_STYLES.cardHeader</span>
                      <h5 className={TYPOGRAPHY_STYLES.cardHeader}>Card Label Category</h5>
                    </div>

                    {/* title */}
                    <div className="p-3 border border-gray-100 rounded-lg">
                      <span className="text-[10px] font-bold text-gray-400 block mb-1">TYPOGRAPHY_STYLES.title</span>
                      <h3 className={TYPOGRAPHY_STYLES.title}>Dialog Panel Title</h3>
                    </div>

                    {/* subtitle */}
                    <div className="p-3 border border-gray-100 rounded-lg">
                      <span className="text-[10px] font-bold text-gray-400 block mb-1">TYPOGRAPHY_STYLES.subtitle</span>
                      <p className={TYPOGRAPHY_STYLES.subtitle}>Sub-heading details explaining coordinates and BIM statistics.</p>
                    </div>

                    {/* body */}
                    <div className="p-3 border border-gray-100 rounded-lg">
                      <span className="text-[10px] font-bold text-gray-400 block mb-1">TYPOGRAPHY_STYLES.body</span>
                      <p className={TYPOGRAPHY_STYLES.body}>Tabular row node descriptions and general body content text styling.</p>
                    </div>

                    {/* label */}
                    <div className="p-3 border border-gray-100 rounded-lg">
                      <span className="text-[10px] font-bold text-gray-400 block mb-1">TYPOGRAPHY_STYLES.label</span>
                      <span className={TYPOGRAPHY_STYLES.label}>Interactive Form Control Label</span>
                    </div>

                    {/* mono */}
                    <div className="p-3 border border-gray-100 rounded-lg">
                      <span className="text-[10px] font-bold text-gray-400 block mb-1">TYPOGRAPHY_STYLES.mono</span>
                      <span className={TYPOGRAPHY_STYLES.mono}>550e8400-e29b-11d4-a716-446655440000 (UUID)</span>
                    </div>
                  </div>
                  
                  <CodeBlock code={`import { TYPOGRAPHY_STYLES } from '../styles/designSystem'\n\n<h4 className={TYPOGRAPHY_STYLES.sectionHeader}>Input Options</h4>`} />
                </div>
              </div>
            )}

            {/* TAB CONTENT: Tables & Tab Filters */}
            {activeTab === 'tables' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className={PANEL_STYLES.card}>
                  <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
                    <Table className="w-5 h-5 text-brand-600" />
                    <h3 className="font-bold text-gray-900">Segmented Tabs & Underlines</h3>
                  </div>
                  
                  <div className="space-y-6">
                    {/* Segmented active/inactive */}
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-gray-700">Pill Segment Container (TAB_STYLES.container)</span>
                      <div className={TAB_STYLES.container + " w-fit"}>
                        <button className={TAB_STYLES.tabActive}>Active Pill</button>
                        <button className={TAB_STYLES.tabInactive}>Inactive Pill</button>
                      </div>
                    </div>

                    {/* Segmented filter controls */}
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-gray-700">Filter Segment Labels (TAB_STYLES.filterActive / filterInactive)</span>
                      <div className="flex items-center gap-2">
                        <button className={TAB_STYLES.filterActive}>Concrete Active</button>
                        <button className={TAB_STYLES.filterInactive}>Steel Inactive</button>
                      </div>
                    </div>

                    {/* Underline Tabs */}
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-gray-700">Underlined Section Selector Tabs (TAB_STYLES.underlineActive / underlineInactive)</span>
                      <div className="flex gap-4 border-b border-gray-100">
                        <button className={TAB_STYLES.underlineActive}>Active Underline Tab</button>
                        <button className={TAB_STYLES.underlineInactive}>Inactive Underline Tab</button>
                      </div>
                    </div>
                  </div>

                  <CodeBlock code={`import { TAB_STYLES } from '../styles/designSystem'\n\n<div className={TAB_STYLES.container}>\n  <button className={TAB_STYLES.tabActive}>Active</button>\n</div>`} />
                </div>

                <div className={PANEL_STYLES.card}>
                  <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
                    <Table className="w-5 h-5 text-gray-600" />
                    <h3 className="font-bold text-gray-900">Tabular Visual Layout</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    Centralized border systems, header styling, and alternate padding tokens for dense rows.
                  </p>

                  <div className="space-y-4">
                    <div className={TABLE_STYLES.container + " overflow-hidden"}>
                      {/* Header Row */}
                      <div className={TABLE_STYLES.headerRow + " grid grid-cols-3"}>
                        <div className={TABLE_STYLES.headerCell}>Node Taxonomy</div>
                        <div className={TABLE_STYLES.headerCell}>Label</div>
                        <div className={TABLE_STYLES.headerCell}>Absolute UUID</div>
                      </div>
                      
                      {/* Body Row (Dense) */}
                      <div className={TABLE_STYLES.rowHover + " grid grid-cols-3 border-b border-gray-100"}>
                        <div className={TABLE_STYLES.bodyCellDense + " font-mono"}>Mesh</div>
                        <div className={TABLE_STYLES.bodyCellDense + " font-semibold text-gray-900"}>Wall_Structure_42</div>
                        <div className={TABLE_STYLES.bodyCellDense + " font-mono text-gray-500"}>25e24a-71ff-4890</div>
                      </div>

                      {/* Body Row (Standard) */}
                      <div className={TABLE_STYLES.rowHover + " grid grid-cols-3"}>
                        <div className={TABLE_STYLES.bodyCell + " font-mono"}>Group</div>
                        <div className={TABLE_STYLES.bodyCell + " font-semibold text-gray-900"}>Floor_Assembly_01</div>
                        <div className={TABLE_STYLES.bodyCell + " font-mono text-gray-500"}>48cc92-12ff-89d1</div>
                      </div>
                    </div>
                  </div>

                  <CodeBlock code={`import { TABLE_STYLES } from '../styles/designSystem'\n\n<div className={TABLE_STYLES.headerRow}>\n  <div className={TABLE_STYLES.headerCell}>Header</div>\n</div>`} />
                </div>
              </div>
            )}

            {/* TAB CONTENT: Buttons & Actions */}
            {activeTab === 'buttons' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className={PANEL_STYLES.card}>
                  <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
                    <MousePointerClick className="w-5 h-5 text-brand-600" />
                    <h3 className="font-bold text-gray-900">Button Classes</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    Interactive actions with distinct visual hierarchies, hover states, and disabled behaviors.
                  </p>

                  <div className="space-y-6">
                    {/* Primary Button */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-gray-800">Primary Button</span>
                        <p className="text-xs text-gray-500">Used for primary actions like saving a project or processing models.</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button className={BUTTON_STYLES.primary}>
                          Primary Action
                        </button>
                        <button className={BUTTON_STYLES.primary} disabled>
                          Disabled
                        </button>
                      </div>
                    </div>
                    <CodeBlock code={`import { BUTTON_STYLES } from '../styles/designSystem'\n\n<button className={BUTTON_STYLES.primary}>\n  Primary Action\n</button>`} />

                    {/* Secondary Button */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-gray-800">Secondary / Cancel Button</span>
                        <p className="text-xs text-gray-500">Used for secondary actions, dismissing dialogs, or going back.</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button className={BUTTON_STYLES.secondary}>
                          Secondary Action
                        </button>
                        <button className={BUTTON_STYLES.secondary} disabled>
                          Disabled
                        </button>
                      </div>
                    </div>
                    <CodeBlock code={`<button className={BUTTON_STYLES.secondary}>\n  Secondary Action\n</button>`} />

                    {/* Destructive Button */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-gray-800">Destructive Button</span>
                        <p className="text-xs text-gray-500">Used inside confirmation modals for deletes or destructive changes.</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button className={BUTTON_STYLES.destructive}>
                          Delete Project
                        </button>
                      </div>
                    </div>
                    <CodeBlock code={`<button className={BUTTON_STYLES.destructive}>\n  Delete Project\n</button>`} />

                    {/* Action link / Subtle buttons */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-gray-800">Subtle Button</span>
                        <p className="text-xs text-gray-500">Smaller text, padding, and subtle hover borders. Used for dialog cancel options.</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button className={BUTTON_STYLES.subtle}>
                          Dismiss
                        </button>
                      </div>
                    </div>
                    <CodeBlock code={`<button className={BUTTON_STYLES.subtle}>\n  Dismiss\n</button>`} />
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Form Controls & Inputs */}
            {activeTab === 'inputs' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className={PANEL_STYLES.card}>
                  <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
                    <FormInput className="w-5 h-5 text-brand-600" />
                    <h3 className="font-bold text-gray-900">Standard Text & Search Inputs</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    Inputs styled with brand pink focus borders and interactive rings.
                  </p>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className={INPUT_STYLES.label}>Interactive Input Label</label>
                        <input
                          type="text"
                          placeholder="Type something..."
                          value={demoTextInput}
                          onChange={e => setDemoTextInput(e.target.value)}
                          className={INPUT_STYLES.text}
                        />
                        {demoTextInput && (
                          <p className="text-[10px] text-brand-600 font-semibold animate-in slide-in-from-top-1">
                            Current Value: "{demoTextInput}"
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className={INPUT_STYLES.label}>Search Input Layout</label>
                        <div className="relative">
                          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <input
                            type="text"
                            placeholder="Search projects database..."
                            className={INPUT_STYLES.search}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <CodeBlock code={`import { INPUT_STYLES } from \'../styles/designSystem\'\n\n<label className={INPUT_STYLES.label}>Project Title</label>\n<input className={INPUT_STYLES.text} placeholder="Title..." />`} />
                  </div>
                </div>

                <div className={PANEL_STYLES.card}>
                  <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
                    <Tag className="w-5 h-5 text-brand-600" />
                    <h3 className="font-bold text-gray-900">Interactive TagInput Component</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    The custom tag organizer imported from <code className="bg-gray-100 px-1 py-0.5 rounded text-brand-600">src/components/Admin/TagInput.tsx</code>. Type tags and press comma or enter to test.
                  </p>

                  <div className="space-y-4">
                    <div className="max-w-md">
                      <TagInput value={demoTags} onChange={setDemoTags} />
                    </div>
                    <p className="text-[10px] text-gray-400">
                      Serialized Tag State: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-700">{JSON.stringify(demoTags)}</code>
                    </p>
                  </div>
                </div>

                <div className={PANEL_STYLES.card}>
                  <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
                    <Layers className="w-5 h-5 text-brand-600" />
                    <h3 className="font-bold text-gray-900">Custom Slider Toggles</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    Smooth slider switches used in project lists to change map visibility.
                  </p>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={demoCheckbox}
                      onClick={() => setDemoCheckbox(!demoCheckbox)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                        demoCheckbox ? 'bg-brand-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                          demoCheckbox ? 'translate-x-4' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className="text-xs text-gray-600 font-semibold">
                      {demoCheckbox ? 'Visible on map (Active)' : 'Hidden from map (Inactive)'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Badges & Labels */}
            {activeTab === 'badges' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className={PANEL_STYLES.card}>
                  <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
                    <Tag className="w-5 h-5 text-brand-600" />
                    <h3 className="font-bold text-gray-900">Status & Category Badges</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    Rounded labels representing project properties, completion status, or tags.
                  </p>

                  <div className="space-y-6">
                    <div className="flex flex-wrap gap-3">
                      <span className={BADGE_STYLES.brand}>Brand Tag Badge</span>
                      <span className={BADGE_STYLES.neutral}>Neutral Category Badge</span>
                      <span className={BADGE_STYLES.success}>Success Badge</span>
                      <span className={BADGE_STYLES.error}>Error Alert Badge</span>
                      <span className={BADGE_STYLES.warning}>Warning Badge</span>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-gray-700 block">Status Dots (from table/cards list)</span>
                      <div className="flex items-center gap-6">
                        <span className="flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="w-2 h-2 rounded-full bg-green-600" /> Completed Project
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="w-2 h-2 rounded-full bg-blue-600" /> Under Construction
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="w-2 h-2 rounded-full bg-amber-400" /> Planning State
                        </span>
                      </div>
                    </div>

                    <CodeBlock code={`import { BADGE_STYLES } from \'../styles/designSystem\'\n\n<span className={BADGE_STYLES.brand}>brand tag</span>\n<span className={BADGE_STYLES.success}>success state</span>`} />
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Modals & Dialog Overlays */}
            {activeTab === 'overlays' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className={PANEL_STYLES.card}>
                  <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
                    <Layers className="w-5 h-5 text-brand-600" />
                    <h3 className="font-bold text-gray-900">Modal Confirmation Dialogs</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    Trigger the real dialog component wrapper directly to verify overlay shadows, dark borders, and button consolidation styles.
                  </p>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => {
                        setDialogDestructive(false)
                        setIsDialogOpen(true)
                      }}
                      className={BUTTON_STYLES.primary}
                    >
                      Trigger Standard Dialog
                    </button>
                    
                    <button
                      onClick={() => {
                        setDialogDestructive(true)
                        setIsDialogOpen(true)
                      }}
                      className={BUTTON_STYLES.destructive}
                    >
                      Trigger Destructive Dialog
                    </button>
                  </div>

                  {isDialogOpen && (
                    <ConfirmDialog
                      title={dialogDestructive ? "Permanent Deletion" : "Save Changes"}
                      message={
                        dialogDestructive
                          ? "Are you sure you want to delete this resource? This action will permanently remove database indices."
                          : "This updates metadata coordinates for digital assets. Press confirm to commit database states."
                      }
                      confirmLabel={dialogDestructive ? "Delete Resource" : "Commit Save"}
                      destructive={dialogDestructive}
                      onConfirm={() => {
                        setIsDialogOpen(false)
                        showToast(
                          dialogDestructive ? "Mock resource was deleted" : "Changes saved in mock catalog",
                          dialogDestructive ? "error" : "success"
                        )
                      }}
                      onCancel={() => {
                        setIsDialogOpen(false)
                        showToast("User cancelled dialog interaction", "success")
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: Loaders & Toast Alerts */}
            {activeTab === 'utilities' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className={PANEL_STYLES.card}>
                  <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
                    <HelpCircle className="w-5 h-5 text-brand-600" />
                    <h3 className="font-bold text-gray-900">Interactive Toast Notifications</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    Spawn real banner alerts using the hook <code className="bg-gray-100 px-1 py-0.5 rounded text-brand-600">useToast()</code>. They appear at the bottom right.
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={() => showToast("Database synchronization complete!", "success")}
                      className={BUTTON_STYLES.primary}
                    >
                      Show Success Toast
                    </button>
                    
                    <button
                      onClick={() => showToast("Could not establish Supabase RLS socket connection.", "error")}
                      className={BUTTON_STYLES.destructive}
                    >
                      Show Error Toast
                    </button>
                  </div>
                </div>

                <div className={PANEL_STYLES.card}>
                  <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
                    <HelpCircle className="w-5 h-5 text-gray-600" />
                    <h3 className="font-bold text-gray-900">Loading Spinners</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    The spinner component used during network requests or GLB conversions.
                  </p>

                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-gray-100 rounded-lg shrink-0">
                      <LoadingSpinner />
                    </div>
                    <span className="text-xs text-gray-500">
                      Spins clockwise using the custom Tailwind animation <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">animate-spin</code>.
                    </span>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      <Toast toasts={toasts} />
    </div>
  )
}
