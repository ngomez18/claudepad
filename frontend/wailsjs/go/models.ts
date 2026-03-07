export namespace plans {
	
	export class Plan {
	    path: string;
	    filename: string;
	    content: string;
	    todoTotal: number;
	    todoDone: number;
	    modifiedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Plan(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.filename = source["filename"];
	        this.content = source["content"];
	        this.todoTotal = source["todoTotal"];
	        this.todoDone = source["todoDone"];
	        this.modifiedAt = source["modifiedAt"];
	    }
	}

}

export namespace projects {
	
	export class Project {
	    id: string;
	    name: string;
	    real_path: string;
	    is_global: boolean;
	    encoded_name: string;
	    last_opened: string;
	    created_at: string;
	
	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.real_path = source["real_path"];
	        this.is_global = source["is_global"];
	        this.encoded_name = source["encoded_name"];
	        this.last_opened = source["last_opened"];
	        this.created_at = source["created_at"];
	    }
	}

}

export namespace sessions {
	
	export class Session {
	    sessionId: string;
	    projectPath: string;
	    slug: string;
	    gitBranch: string;
	    cwd: string;
	    messageCount: number;
	    snippet: string;
	    startedAt: string;
	    durationSecs: number;
	
	    static createFrom(source: any = {}) {
	        return new Session(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.projectPath = source["projectPath"];
	        this.slug = source["slug"];
	        this.gitBranch = source["gitBranch"];
	        this.cwd = source["cwd"];
	        this.messageCount = source["messageCount"];
	        this.snippet = source["snippet"];
	        this.startedAt = source["startedAt"];
	        this.durationSecs = source["durationSecs"];
	    }
	}
	export class TranscriptMessage {
	    role: string;
	    text: string;
	    tools: string[];
	    timestamp: string;
	
	    static createFrom(source: any = {}) {
	        return new TranscriptMessage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.role = source["role"];
	        this.text = source["text"];
	        this.tools = source["tools"];
	        this.timestamp = source["timestamp"];
	    }
	}

}

export namespace settings {
	
	export class SettingsFile {
	    layer: string;
	    path: string;
	    content: string;
	    exists: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SettingsFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.layer = source["layer"];
	        this.path = source["path"];
	        this.content = source["content"];
	        this.exists = source["exists"];
	    }
	}

}

export namespace usage {
	
	export class DailyActivity {
	    date: string;
	    messageCount: number;
	    sessionCount: number;
	    toolCallCount: number;
	
	    static createFrom(source: any = {}) {
	        return new DailyActivity(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.date = source["date"];
	        this.messageCount = source["messageCount"];
	        this.sessionCount = source["sessionCount"];
	        this.toolCallCount = source["toolCallCount"];
	    }
	}
	export class DailyModelTokens {
	    date: string;
	    tokensByModel: Record<string, number>;
	
	    static createFrom(source: any = {}) {
	        return new DailyModelTokens(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.date = source["date"];
	        this.tokensByModel = source["tokensByModel"];
	    }
	}
	export class LongestSession {
	    sessionId: string;
	    duration: number;
	    messageCount: number;
	    timestamp: string;
	
	    static createFrom(source: any = {}) {
	        return new LongestSession(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.duration = source["duration"];
	        this.messageCount = source["messageCount"];
	        this.timestamp = source["timestamp"];
	    }
	}
	export class ModelUsage {
	    inputTokens: number;
	    outputTokens: number;
	    cacheReadInputTokens: number;
	    cacheCreationInputTokens: number;
	    webSearchRequests: number;
	    costUSD: number;
	    contextWindow: number;
	    maxOutputTokens: number;
	
	    static createFrom(source: any = {}) {
	        return new ModelUsage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.inputTokens = source["inputTokens"];
	        this.outputTokens = source["outputTokens"];
	        this.cacheReadInputTokens = source["cacheReadInputTokens"];
	        this.cacheCreationInputTokens = source["cacheCreationInputTokens"];
	        this.webSearchRequests = source["webSearchRequests"];
	        this.costUSD = source["costUSD"];
	        this.contextWindow = source["contextWindow"];
	        this.maxOutputTokens = source["maxOutputTokens"];
	    }
	}
	export class StatsCache {
	    version: number;
	    lastComputedDate: string;
	    dailyActivity: DailyActivity[];
	    dailyModelTokens: DailyModelTokens[];
	    modelUsage: Record<string, ModelUsage>;
	    totalSessions: number;
	    totalMessages: number;
	    longestSession: LongestSession;
	    firstSessionDate: string;
	    hourCounts: Record<string, number>;
	    totalSpeculationTimeSavedMs: number;
	
	    static createFrom(source: any = {}) {
	        return new StatsCache(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.lastComputedDate = source["lastComputedDate"];
	        this.dailyActivity = this.convertValues(source["dailyActivity"], DailyActivity);
	        this.dailyModelTokens = this.convertValues(source["dailyModelTokens"], DailyModelTokens);
	        this.modelUsage = this.convertValues(source["modelUsage"], ModelUsage, true);
	        this.totalSessions = source["totalSessions"];
	        this.totalMessages = source["totalMessages"];
	        this.longestSession = this.convertValues(source["longestSession"], LongestSession);
	        this.firstSessionDate = source["firstSessionDate"];
	        this.hourCounts = source["hourCounts"];
	        this.totalSpeculationTimeSavedMs = source["totalSpeculationTimeSavedMs"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

