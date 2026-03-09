package fs

import (
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// Watcher watches specific files and directories for changes and calls registered callbacks.
// It watches the parent directory rather than the file directly, which handles
// atomic writes (write-to-temp + rename) correctly.
//
// For directories that don't exist yet at registration time, WatchDir stores them as
// "pending" and activates the real watch the moment they are created.
type Watcher struct {
	fsw      *fsnotify.Watcher
	handlers map[string]func()
	pending  map[string]func() // dirs not yet created; key = abs path (no trailing sep)
	mu       sync.Mutex
	done     chan struct{}
}

func NewWatcher() (*Watcher, error) {
	fsw, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}
	w := &Watcher{
		fsw:      fsw,
		handlers: make(map[string]func()),
		pending:  make(map[string]func()),
		done:     make(chan struct{}),
	}
	go w.loop()
	return w, nil
}

// Watch registers onChange to be called when the file at path is modified.
func (w *Watcher) Watch(path string, onChange func()) error {
	abs, err := filepath.Abs(path)
	if err != nil {
		return err
	}
	w.mu.Lock()
	w.handlers[abs] = onChange
	w.mu.Unlock()
	return w.fsw.Add(filepath.Dir(abs))
}

// WatchDir registers onChange to be called when any file inside dir changes.
// If dir does not exist yet, the watch is deferred: the parent directory is
// monitored instead, and the real watch is activated as soon as dir is created.
func (w *Watcher) WatchDir(dir string, onChange func()) error {
	abs, err := filepath.Abs(dir)
	if err != nil {
		return err
	}
	// Store with a trailing slash so it can't collide with a file path.
	w.mu.Lock()
	w.handlers[abs+string(filepath.Separator)] = onChange
	w.mu.Unlock()

	if err := w.fsw.Add(abs); err != nil {
		// Directory doesn't exist yet — store as pending and watch its parent
		// so we're notified when it's created.
		w.mu.Lock()
		w.pending[abs] = onChange
		w.mu.Unlock()
		_ = w.fsw.Add(filepath.Dir(abs)) // best-effort; ignore error
		return nil
	}
	return nil
}

func (w *Watcher) Close() {
	select {
	case <-w.done:
	default:
		close(w.done)
	}
	w.fsw.Close()
}

func (w *Watcher) loop() {
	const debounce = 300 * time.Millisecond
	last := make(map[string]time.Time)

	for {
		select {
		case <-w.done:
			return
		case event, ok := <-w.fsw.Events:
			if !ok {
				return
			}
			if event.Op&(fsnotify.Write|fsnotify.Create|fsnotify.Rename) == 0 {
				continue
			}
			abs, _ := filepath.Abs(event.Name)

			// Check if a pending directory was just created.
			if event.Op&fsnotify.Create != 0 {
				w.mu.Lock()
				if _, isPending := w.pending[abs]; isPending {
					delete(w.pending, abs)
					handler := w.handlers[abs+string(filepath.Separator)]
					w.mu.Unlock()
					_ = w.fsw.Add(abs) // activate the real watch
					if handler != nil {
						go handler() // fire immediately for the just-created dir
					}
					continue
				}
				w.mu.Unlock()
			}

			w.mu.Lock()
			handler, ok := w.handlers[abs]
			if !ok {
				// Check if a directory handler covers this file.
				dirKey := filepath.Dir(abs) + string(filepath.Separator)
				handler, ok = w.handlers[dirKey]
			}
			w.mu.Unlock()
			if !ok {
				continue
			}
			if time.Since(last[abs]) < debounce {
				continue
			}
			last[abs] = time.Now()
			go handler()
		case _, ok := <-w.fsw.Errors:
			if !ok {
				return
			}
		}
	}
}
