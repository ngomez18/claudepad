package fs

import (
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// Watcher watches specific files for changes and calls registered callbacks.
// It watches the parent directory rather than the file directly, which handles
// atomic writes (write-to-temp + rename) correctly.
type Watcher struct {
	fsw      *fsnotify.Watcher
	handlers map[string]func()
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
func (w *Watcher) WatchDir(dir string, onChange func()) error {
	abs, err := filepath.Abs(dir)
	if err != nil {
		return err
	}
	// Store with a trailing slash so it can't collide with a file path.
	w.mu.Lock()
	w.handlers[abs+string(filepath.Separator)] = onChange
	w.mu.Unlock()
	return w.fsw.Add(abs)
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
