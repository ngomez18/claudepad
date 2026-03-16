// Package mcp implements an SSE-based MCP server that runs embedded inside
// the Claudepad process. Claude Code connects to it via HTTP instead of
// spawning a subprocess.
//
// Transport: MCP over SSE (protocol version 2024-11-05)
//   GET  /sse       — open event stream; server sends endpoint URL
//   POST /messages  — client sends JSON-RPC requests here
package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

const DefaultPort = 45789

// ── JSON-RPC types ────────────────────────────────────────────────────────────

type rpcRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      any             `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type rpcResponse struct {
	JSONRPC string    `json:"jsonrpc"`
	ID      any       `json:"id,omitempty"`
	Result  any       `json:"result,omitempty"`
	Error   *rpcError `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// ── Static responses ──────────────────────────────────────────────────────────

var initResult = map[string]any{
	"protocolVersion": "2024-11-05",
	"capabilities":    map[string]any{"tools": map[string]any{}},
	"serverInfo":      map[string]any{"name": "claudepad", "version": "1.0.0"},
}

var toolsList = map[string]any{
	"tools": []map[string]any{
		{
			"name":        "save_note",
			"description": "Save a note to Claudepad (~/.claudepad/notes/)",
			"inputSchema": map[string]any{
				"type":     "object",
				"required": []string{"title", "content"},
				"properties": map[string]any{
					"title":   map[string]any{"type": "string", "description": "Concise title (5-8 words)"},
					"content": map[string]any{"type": "string", "description": "Markdown content"},
					"cwd":     map[string]any{"type": "string", "description": "Current working directory"},
				},
			},
		},
	},
}

// ── Server ────────────────────────────────────────────────────────────────────

// Server is an embedded SSE-based MCP server.
type Server struct {
	port     int
	sessions sync.Map      // sessionID → chan string
	httpSrv  *http.Server
}

// Start starts the MCP server on the given port and returns the port it is
// listening on. If port is 0, an available port is chosen automatically.
func Start(ctx context.Context, port int) (*Server, int, error) {
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		// If the preferred port is busy, fall back to any available port.
		ln, err = net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			return nil, 0, err
		}
	}

	s := &Server{port: ln.Addr().(*net.TCPAddr).Port}
	mux := http.NewServeMux()
	mux.HandleFunc("/sse", s.handleSSE)
	mux.HandleFunc("/messages", s.handleMessages)
	s.httpSrv = &http.Server{Handler: mux}

	go func() {
		_ = s.httpSrv.Serve(ln)
	}()

	// Shut down gracefully when ctx is cancelled.
	go func() {
		<-ctx.Done()
		shutCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = s.httpSrv.Shutdown(shutCtx)
	}()

	return s, s.port, nil
}

func (s *Server) Port() int { return s.port }

// ── SSE handler ───────────────────────────────────────────────────────────────

func (s *Server) handleSSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	sessionID := uuid.NewString()
	ch := make(chan string, 32)
	s.sessions.Store(sessionID, ch)
	defer s.sessions.Delete(sessionID)

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Tell the client where to POST requests.
	fmt.Fprintf(w, "event: endpoint\ndata: /messages?sessionId=%s\n\n", sessionID)
	flusher.Flush()

	for {
		select {
		case msg := <-ch:
			fmt.Fprintf(w, "data: %s\n\n", msg)
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}

// ── Messages handler ──────────────────────────────────────────────────────────

func (s *Server) handleMessages(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.WriteHeader(http.StatusNoContent)
		return
	}

	sessionID := r.URL.Query().Get("sessionId")
	val, ok := s.sessions.Load(sessionID)
	if !ok {
		http.Error(w, "unknown session", http.StatusBadRequest)
		return
	}
	ch := val.(chan string)

	var req rpcRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	// Notifications have no id and need no response.
	if req.Method == "notifications/initialized" {
		w.WriteHeader(http.StatusAccepted)
		return
	}

	resp := s.dispatch(req)
	data, _ := json.Marshal(resp)
	ch <- string(data)
	w.WriteHeader(http.StatusAccepted)
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

func (s *Server) dispatch(req rpcRequest) rpcResponse {
	var result any
	var rpcErr *rpcError

	switch req.Method {
	case "initialize":
		result = initResult
	case "tools/list":
		result = toolsList
	case "tools/call":
		var call struct {
			Name      string          `json:"name"`
			Arguments json.RawMessage `json:"arguments"`
		}
		if err := json.Unmarshal(req.Params, &call); err != nil {
			rpcErr = &rpcError{Code: -32602, Message: "invalid params"}
		} else if call.Name == "save_note" {
			result, rpcErr = saveNote(call.Arguments)
		} else {
			rpcErr = &rpcError{Code: -32601, Message: "unknown tool: " + call.Name}
		}
	default:
		rpcErr = &rpcError{Code: -32601, Message: "method not found: " + req.Method}
	}

	return rpcResponse{JSONRPC: "2.0", ID: req.ID, Result: result, Error: rpcErr}
}

// ── save_note tool ────────────────────────────────────────────────────────────

var nonAlphaNum = regexp.MustCompile(`[^a-z0-9]+`)

func titleToSlug(title string) string {
	slug := nonAlphaNum.ReplaceAllString(strings.ToLower(title), "-")
	slug = strings.Trim(slug, "-")
	if len(slug) > 40 {
		slug = strings.TrimRight(slug[:40], "-")
	}
	return slug
}

func saveNote(params json.RawMessage) (any, *rpcError) {
	var args struct {
		Title   string `json:"title"`
		Content string `json:"content"`
		Cwd     string `json:"cwd"`
	}
	if err := json.Unmarshal(params, &args); err != nil {
		return nil, &rpcError{Code: -32602, Message: "invalid params: " + err.Error()}
	}
	if args.Title == "" || args.Content == "" {
		return nil, &rpcError{Code: -32602, Message: "title and content are required"}
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return nil, &rpcError{Code: -32603, Message: err.Error()}
	}
	dir := filepath.Join(home, ".claudepad", "notes")
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, &rpcError{Code: -32603, Message: err.Error()}
	}

	filename := time.Now().Format("2006-01-02") + "-" + titleToSlug(args.Title) + ".md"
	path := filepath.Join(dir, filename)

	var sb strings.Builder
	sb.WriteString("---\n")
	fmt.Fprintf(&sb, "title: %s\n", args.Title)
	if args.Cwd != "" {
		fmt.Fprintf(&sb, "project: %s\n", args.Cwd)
	}
	sb.WriteString("---\n\n")
	sb.WriteString(args.Content)

	if err := os.WriteFile(path, []byte(sb.String()), 0o644); err != nil {
		return nil, &rpcError{Code: -32603, Message: err.Error()}
	}

	return map[string]any{
		"content": []map[string]any{
			{"type": "text", "text": "Note saved: " + path},
		},
	}, nil
}
