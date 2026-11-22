export type TabId = "topology" | "releases" | "cleanup" | "spawn" | "doctor" | "config";
export type ThemeMode = "system" | "dark" | "light";
export type AppIconStyle = "dark" | "light" | "auto";
export type LanguagePreference = "system" | "zh" | "en";
export type Locale = "zh" | "en";
export type SettingsTabId = "proxy" | "appearance" | "language" | "updates";
export type ProxyMode = "direct" | "system" | "custom";
export type ProxyProtocol = "http" | "https" | "socks5";

export interface LanguageState {
  preference: LanguagePreference;
  resolved: Locale;
}

export interface ProxySettings {
  mode: ProxyMode;
  protocol: ProxyProtocol;
  host: string;
  port: string;
  username: string;
  password: string;
  bypass: string;
}

export interface SystemProxyInfo {
  httpEnabled: boolean;
  httpHost: string | null;
  httpPort: number | null;
  httpsEnabled: boolean;
  httpsHost: string | null;
  httpsPort: number | null;
  socksEnabled: boolean;
  socksHost: string | null;
  socksPort: number | null;
  exceptions: string[];
  effectiveUrl: string | null;
}

export interface ProxyTestResult {
  ok: boolean;
  latencyMs: number;
  targetUrl: string;
  proxyUsed: string | null;
  httpStatus: number | null;
  message: string;
}

export interface ForkEntry {
  name: string;
  url: string;
}

export interface FvmContextInfo {
  fvmVersion: string;
  fvmBin: string;
  fvmDir: string;
  versionsCachePath: string;
  gitCachePath: string;
  globalCacheLink: string;
  globalCacheBinPath: string;
  projectsRegistryPath: string;
  appConfigPath: string;
  flutterUrl: string;
  gitCache: boolean;
  updateCheckDisabled: boolean;
  runPubGetOnSdkChanges: boolean;
  privilegedAccess: boolean;
  globalVersion: string | null;
  forks: ForkEntry[];
  activeFlutterPath: string | null;
  pathPriorityOk: boolean;
  osLabel: string;
  archLabel: string;
  gitCacheBytes: number;
}

export interface CachedSdkInfo {
  name: string;
  directory: string;
  releaseFromChannel: string | null;
  sdkType: string;
  binPath: string;
  flutterSdkVersion: string | null;
  dartSdkVersion: string | null;
  isSetup: boolean;
  sizeBytes: number;
  isGlobal: boolean;
  isUnreferenced: boolean;
}

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  pinnedVersion: string | null;
  activeFlavor: string | null;
  flavors: Record<string, string>;
  isFlutter: boolean;
  hasConfig: boolean;
  hasMelos: boolean;
  vscodeSynced: boolean;
  ideaSynced: boolean;
  hasIdeaDir: boolean;
  symlinkExists: boolean;
  fvmrcRaw: string | null;
}

export interface ReleaseItem {
  version: string;
  channel: string;
  releaseDate: string;
  hash: string;
  dartSdkVersion: string;
  dartSdkArch: string;
  activeChannel: boolean;
  archiveUrl: string;
  sha256: string;
}

export interface ChannelHead {
  stable: ReleaseItem | null;
  beta: ReleaseItem | null;
  dev: ReleaseItem | null;
}

export interface ReleasesResponse {
  versions: ReleaseItem[];
  channels: ChannelHead;
}

export interface CleanupAction {
  arguments: string[];
  workingDirectory: string | null;
}

export interface PatchUpgradeItem {
  fromVersion: string;
  toVersion: string;
  reason: string;
  actions: CleanupAction[];
}

export interface CleanupReport {
  upgrades: PatchUpgradeItem[];
  unused: string[];
  removable: string[];
}

export interface WorkspaceSnapshot {
  context: FvmContextInfo;
  totalCacheSizeLabel: string;
  totalCacheBytes: number;
  versions: CachedSdkInfo[];
  projects: ProjectInfo[];
  unreferencedVersions: string[];
  cleanup: CleanupReport;
}

export interface CliStreamEvent {
  requestId: string;
  kind: "started" | "stdout" | "stderr" | "finished" | "cancelled" | "error";
  line: string | null;
  exitCode: number | null;
  durationMs: number | null;
}

export interface SpawnTaskRequest {
  id: string;
  label: string;
  args: string[];
}

export interface SpawnStreamEvent {
  requestId: string;
  taskId: string;
  label: string;
  kind: "started" | "stdout" | "stderr" | "finished" | "cancelled" | "error";
  line: string | null;
  exitCode: number | null;
  durationMs: number | null;
}

export interface CliLogEntry {
  id: string;
  time: string;
  cmd: string;
  cwd?: string;
  status: "RUNNING" | "OK" | "WARN" | "ERR" | "CANCELLED";
  lines: string[];
  exitCode?: number | null;
  durationMs?: number | null;
}

export interface SpawnTaskResult {
  taskId: string;
  label: string;
  cmd: string;
  status: "RUNNING" | "PASS" | "FAIL" | "CANCELLED";
  lines: string[];
  durationMs: number | null;
  exitCode: number | null;
}

export interface DoctorOutput {
  rawOutput: string;
  exitCode: number;
}

export interface ToastItem {
  id: string;
  message: string;
  tone: "info" | "success" | "warning" | "error";
}

export interface AppVersionInfo {
  version: string;
  os: string;
  arch: string;
  repoUrl: string;
  releasesUrl: string;
}

export interface ReleaseAssetInfo {
  name: string;
  downloadUrl: string;
  sizeBytes: number;
}

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  tagName: string;
  hasUpdate: boolean;
  releaseName: string;
  releaseNotes: string | null;
  publishedAt: string | null;
  releaseUrl: string;
  prerelease: boolean;
  recommendedAsset: ReleaseAssetInfo | null;
  assets: ReleaseAssetInfo[];
  checkedVia: "github-api" | "github-redirect" | "no-release" | string;
  proxyUsed: string | null;
}

export interface UpdateDownloadEvent {
  requestId: string;
  kind: "started" | "progress" | "finished" | "cancelled" | "error";
  downloadedBytes: number;
  totalBytes: number;
  percent: number | null;
  savedPath: string | null;
  message: string | null;
}

export interface UpdateDownloadState {
  status: "idle" | "downloading" | "downloaded" | "error";
  requestId: string | null;
  assetName: string | null;
  downloadedBytes: number;
  totalBytes: number;
  percent: number | null;
  savedPath: string | null;
  error: string | null;
}
