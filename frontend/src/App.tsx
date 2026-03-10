import { useState, useEffect, useRef } from 'react'
import {
  ClipboardList,
  MessageSquare,
  Settings,
  Brain,
  Terminal,
  BarChart2,
  ChevronDown,
  Plus,
  Globe,
  FolderOpen,
  Check,
  type LucideIcon,
} from 'lucide-react'
import PlansPage from '@/pages/Plans'
import UsagePage from '@/pages/Usage'
import SessionsPage from '@/pages/Sessions'
import SettingsPage from '@/pages/Settings'
import SkillsPage from '@/pages/Skills'
import CommandsPage from '@/pages/Commands'
import { AddProject, PickProjectDir } from '@/lib/api'
import { useProjects } from '@/hooks/useProjects'
import type { projects } from '../wailsjs/go/models'

interface NavItem {
  id: string
  label: string
  Icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { id: 'plans',    label: 'Plans',    Icon: ClipboardList },
  { id: 'sessions', label: 'Sessions', Icon: MessageSquare },
  { id: 'settings', label: 'Settings', Icon: Settings },
  { id: 'skills',   label: 'Skills',   Icon: Brain },
  { id: 'commands', label: 'Commands', Icon: Terminal },
  { id: 'usage',    label: 'Usage',    Icon: BarChart2 },
]

function ProjectPicker({ projectId, onProjectChange, projectList, onAddProject }: {
  projectId: string
  onProjectChange: (id: string) => void
  projectList: projects.Project[] | null
  onAddProject: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = projectList?.find(p => p.id === projectId) ?? null

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative px-3">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white/5 border border-white/8 hover:bg-white/8 transition-colors cursor-pointer outline-none text-left"
        >
          {active?.is_global
            ? <Globe className="size-3.5 shrink-0 text-slate-500" />
            : <FolderOpen className="size-3.5 shrink-0 text-slate-500" />
          }
          <span className="flex-1 text-[13px] text-slate-300 truncate">
            {active?.name ?? 'Loading…'}
          </span>
          <ChevronDown className={`size-3.5 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={onAddProject}
          title="Add project"
          className="shrink-0 size-[30px] flex items-center justify-center rounded-md bg-white/5 border border-white/8 text-slate-500 hover:text-slate-300 hover:bg-white/8 transition-colors cursor-pointer"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {open && (
        <div className="absolute left-3 right-0 top-full mt-1 z-50 rounded-lg border border-white/8 bg-[#1a2035] shadow-xl overflow-hidden">
          {projectList?.map(p => (
            <button
              key={p.id}
              onClick={() => { onProjectChange(p.id); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors cursor-pointer"
            >
              {p.is_global
                ? <Globe className="size-3.5 shrink-0 text-slate-500" />
                : <FolderOpen className="size-3.5 shrink-0 text-slate-500" />
              }
              <span className={`flex-1 text-[13px] truncate ${p.id === projectId ? 'text-slate-100' : 'text-slate-400'}`}>
                {p.name}
              </span>
              {p.id === projectId && <Check className="size-3 shrink-0 text-blue-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Sidebar({ active, onNavigate, projectId, onProjectChange, projectList }: {
  active: string
  onNavigate: (id: string) => void
  projectId: string
  onProjectChange: (id: string) => void
  projectList: projects.Project[] | null
}) {
  async function handleAddProject() {
    const path = await PickProjectDir()
    if (!path) return
    await AddProject(path)
  }

  return (
    <aside className="flex flex-col w-48 shrink-0 h-screen bg-[#161b27] border-r border-white/5 py-5">
      <div className="px-5 pb-4 text-[16px] font-semibold tracking-tight text-slate-100">
        Claudepad
      </div>

      <ProjectPicker
        projectId={projectId}
        onProjectChange={onProjectChange}
        projectList={projectList}
        onAddProject={handleAddProject}
      />

      <div className="my-4 h-px bg-white/5" />

      <nav className="flex flex-col gap-0.5 px-2 flex-1">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-[15px] font-medium transition-colors text-left cursor-pointer border-0 outline-none
              ${active === id
                ? 'bg-blue-500/15 text-blue-300'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  )
}

function PageContent({ section, activeProject, projectList }: {
  section: string
  activeProject: projects.Project | null
  projectList: projects.Project[] | null
}) {
  const item = NAV_ITEMS.find(n => n.id === section)

  const isEdgeToEdge = section === 'plans' || section === 'sessions' || section === 'skills' || section === 'commands'

  return (
    <main className={`flex-1 flex flex-col overflow-hidden bg-[#0f1117] ${isEdgeToEdge ? '' : 'p-10 overflow-y-auto'}`}>
      {!isEdgeToEdge && (
        <div className="flex items-baseline gap-3 mb-8">
          <h1 className="text-[24px] font-bold text-slate-100 m-0">{item?.label}</h1>
          <span className="text-sm text-slate-500 bg-white/5 px-2 py-0.5 rounded">
            {activeProject?.name ?? 'Global'}
          </span>
        </div>
      )}

      {section === 'plans' ? (
        <PlansPage projects={projectList} />
      ) : section === 'sessions' ? (
        <SessionsPage activeProject={activeProject} />
      ) : section === 'settings' ? (
        <SettingsPage activeProject={activeProject} />
      ) : section === 'skills' ? (
        <SkillsPage activeProject={activeProject} />
      ) : section === 'commands' ? (
        <CommandsPage activeProject={activeProject} />
      ) : section === 'usage' ? (
        <UsagePage />
      ) : (
        <p className="text-sm text-slate-600">{item?.label} content goes here.</p>
      )}
    </main>
  )
}

export default function App() {
  const [activeSection, setActiveSection] = useState('plans')
  const [projectId, setProjectId] = useState<string>('')
  const { data: projectList } = useProjects()

  // Default to the global project (first in the list) once loaded.
  useEffect(() => {
    if (!projectId && projectList && projectList.length > 0) {
      setProjectId(projectList[0].id)
    }
  }, [projectList, projectId])

  const activeProject = projectList?.find(p => p.id === projectId) ?? null

  return (
    <div className="flex h-screen overflow-hidden dark">
      <Sidebar
        active={activeSection}
        onNavigate={setActiveSection}
        projectId={projectId}
        onProjectChange={setProjectId}
        projectList={projectList ?? null}
      />
      <PageContent section={activeSection} activeProject={activeProject} projectList={projectList ?? null} />
    </div>
  )
}
