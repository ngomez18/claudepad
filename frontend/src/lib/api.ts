// Transport abstraction for Wails IPC.
// All application code imports from this module instead of wailsjs directly,
// so browser mode only needs to change this file.
export {
  GetPlans,
  GetPreservedPlans,
  GetUsageStats,
  GetSessions,
  GetSessionTranscript,
  GetProjects,
  AddProject,
  RemoveProject,
  PickProjectDir,
  GetSkills,
  GetCommands,
  GetSettings,
  UpdateSettings,
  UpdateCommand,
  SetPlanName,
  SetPlanMeta,
  SetProjectLastOpened,
  RevealInFinder,
  GetNotes,
  DeleteNote,
  SetNoteTitle,
  SetNoteMeta,
  GetMcpServers,
  SetMcpServers,
  GetClaudeMd,
  UpdateClaudeMd,
} from '../../wailsjs/go/main/App'

export { EventsOn } from '../../wailsjs/runtime/runtime'
