/**
 * Cloud Replay Interface Component
 * 
 * Displays a timeline-based replay of project execution events
 * Users can scrub through the timeline to view:
 * - Commands executed
 * - Approval decisions
 * - Task status changes
 * - Output and results
 */

import React, { useEffect, useState, useRef } from 'react';

/**
 * ReplayView Component
 * Main replay interface with timeline and event display
 */
export function ReplayView({ projectId, sessionId, onClose }) {
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const timelineRef = useRef(null);

  // Load events from API
  useEffect(() => {
    const loadReplay = async () => {
      setLoading(true);
      setError(null);
      try {
        // Load session summary
        const summaryRes = await fetch(
          `/api/replay-session?project=${encodeURIComponent(projectId)}&sessionId=${encodeURIComponent(sessionId)}`
        );
        if (summaryRes.ok) {
          const data = await summaryRes.json();
          setSummary(data.summary);
        }

        // Load events
        const eventsRes = await fetch(
          `/api/replay-events?project=${encodeURIComponent(projectId)}&sessionId=${encodeURIComponent(sessionId)}`
        );
        if (!eventsRes.ok) {
          setError('Failed to load replay events');
          return;
        }

        const data = await eventsRes.json();
        setEvents(data.events || []);
        setCurrentIndex(0);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    if (projectId && sessionId) {
      loadReplay();
    }
  }, [projectId, sessionId]);

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying || events.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => {
        if (prev >= events.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 500 / playbackSpeed); // 500ms base interval

    return () => clearInterval(interval);
  }, [isPlaying, events.length, playbackSpeed]);

  const currentEvent = events[currentIndex] || null;
  const progress = events.length > 0 ? ((currentIndex + 1) / events.length) * 100 : 0;

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
        <div style={{ fontSize: '14px', marginBottom: '10px' }}>Loading replay data...</div>
        <div style={{ width: '200px', height: '4px', background: '#333', borderRadius: '2px', margin: '0 auto' }}>
          <div style={{ width: '30%', height: '100%', background: '#1976d2', animation: 'pulse 1.5s infinite' }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: '#d32f2f' }}>
        <div style={{ fontSize: '14px', marginBottom: '10px' }}>Error loading replay: {error}</div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 16px',
            background: '#d32f2f',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
        <div style={{ fontSize: '14px' }}>No events recorded for this session</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', height: '100%' }}>
      {/* Session Summary */}
      {summary && (
        <div style={{ 
          background: '#f5f5f5', 
          padding: '12px', 
          borderRadius: '6px', 
          border: '1px solid #ddd',
          fontSize: '12px'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '8px', color: '#333' }}>Session Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            <div>
              <div style={{ opacity: '0.7' }}>Duration</div>
              <div style={{ fontWeight: '600', color: '#1976d2' }}>
                {summary.startTime && summary.endTime 
                  ? Math.round((new Date(summary.endTime) - new Date(summary.startTime)) / 1000) + 's'
                  : 'N/A'}
              </div>
            </div>
            <div>
              <div style={{ opacity: '0.7' }}>Events</div>
              <div style={{ fontWeight: '600', color: '#1976d2' }}>{summary.eventCount || 0}</div>
            </div>
            <div>
              <div style={{ opacity: '0.7' }}>Commands</div>
              <div style={{ fontWeight: '600', color: '#1976d2' }}>{summary.commandCount || 0}</div>
            </div>
            <div>
              <div style={{ opacity: '0.7' }}>Approvals</div>
              <div style={{ fontWeight: '600', color: '#1976d2' }}>{summary.approvalCount || 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div style={{ background: '#1c2128', padding: '12px', borderRadius: '6px' }}>
        <div style={{ fontSize: '12px', marginBottom: '8px', opacity: '0.8' }}>Timeline</div>
        <div 
          ref={timelineRef}
          style={{
            width: '100%',
            height: '40px',
            background: '#0b0f14',
            borderRadius: '4px',
            border: '1px solid #444c56',
            position: 'relative',
            cursor: 'pointer',
            overflow: 'hidden'
          }}
          onClick={(e) => {
            const rect = timelineRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percent = x / rect.width;
            const newIndex = Math.floor(percent * events.length);
            setCurrentIndex(Math.min(newIndex, events.length - 1));
          }}
        >
          {/* Progress bar */}
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #1976d2, #42a5f5)',
            transition: 'width 0.1s linear'
          }} />

          {/* Event markers */}
          {events.map((evt, idx) => {
            const left = (idx / events.length) * 100;
            let color = '#666';
            if (evt.type === 'task:start') color = '#1976d2';
            if (evt.type === 'task:done') color = '#2e7d32';
            if (evt.type === 'cmd:exec') color = '#f57c00';
            if (evt.type === 'DANGER_APPROVED') color = '#2e7d32';
            if (evt.type === 'DANGER_REJECTED') color = '#c62828';
            if (evt.type === 'cmd:error' || evt.error) color = '#d32f2f';

            return (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  top: 0,
                  width: '2px',
                  height: '100%',
                  background: color,
                  opacity: idx === currentIndex ? 1 : 0.4,
                  cursor: 'pointer'
                }}
                title={evt.type}
              />
            );
          })}

          {/* Current position indicator */}
          <div style={{
            position: 'absolute',
            left: `${progress}%`,
            top: '-4px',
            width: '12px',
            height: '48px',
            background: '#58a6ff',
            borderRadius: '2px',
            transform: 'translateX(-50%)',
            pointerEvents: 'none'
          }} />
        </div>

        {/* Timeline controls */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              padding: '6px 12px',
              background: isPlaying ? '#1976d2' : '#444c56',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600'
            }}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>

          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            style={{
              padding: '6px 8px',
              background: '#0b0f14',
              color: '#adbac7',
              border: '1px solid #444c56',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>

          <div style={{ marginLeft: 'auto', fontSize: '12px', opacity: '0.7' }}>
            {currentIndex + 1} / {events.length}
          </div>
        </div>
      </div>

      {/* Event Detail */}
      {currentEvent && (
        <div style={{ background: '#1c2128', padding: '12px', borderRadius: '6px', overflow: 'auto' }}>
          <EventDetail event={currentEvent} eventNumber={currentIndex + 1} />
        </div>
      )}

      {/* Event List */}
      <div style={{ background: '#1c2128', padding: '12px', borderRadius: '6px', overflow: 'auto', maxHeight: '300px' }}>
        <div style={{ fontSize: '12px', marginBottom: '8px', opacity: '0.8', fontWeight: '600' }}>Events</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {events.map((evt, idx) => (
            <EventListItem
              key={idx}
              event={evt}
              index={idx}
              isActive={idx === currentIndex}
              onClick={() => setCurrentIndex(idx)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * EventDetail Component
 * Shows detailed information about a single event
 */
function EventDetail({ event, eventNumber }) {
  const getEventColor = (type) => {
    if (type === 'task:start') return '#1976d2';
    if (type === 'task:done') return '#2e7d32';
    if (type === 'cmd:exec') return '#f57c00';
    if (type === 'DANGER_APPROVED') return '#2e7d32';
    if (type === 'DANGER_REJECTED') return '#c62828';
    if (type === 'cmd:error' || event.error) return '#d32f2f';
    return '#666';
  };

  return (
    <div>
      <div style={{ fontSize: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            background: getEventColor(event.type),
            borderRadius: '50%'
          }} />
          <span style={{ fontWeight: '600', color: '#58a6ff' }}>{event.type}</span>
          <span style={{ opacity: '0.6', marginLeft: 'auto' }}>Event #{eventNumber}</span>
        </div>

        <div style={{ fontSize: '11px', opacity: '0.7', marginBottom: '8px' }}>
          {new Date(event.ts).toLocaleString()}
        </div>
      </div>

      {/* Command */}
      {event.command && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', opacity: '0.8', marginBottom: '4px' }}>Command</div>
          <div style={{
            background: '#0b0f14',
            border: '1px solid #444c56',
            padding: '8px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#58a6ff',
            overflow: 'auto',
            maxHeight: '100px'
          }}>
            {event.command}
          </div>
        </div>
      )}

      {/* Task Title */}
      {event.taskTitle && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', opacity: '0.8', marginBottom: '4px' }}>Task</div>
          <div style={{ fontSize: '12px', color: '#adbac7' }}>{event.taskTitle}</div>
        </div>
      )}

      {/* Status */}
      {event.status && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', opacity: '0.8', marginBottom: '4px' }}>Status</div>
          <div style={{
            display: 'inline-block',
            padding: '4px 8px',
            background: event.status === 'done' ? '#c8e6c9' : event.status === 'error' ? '#ffcdd2' : '#e3f2fd',
            color: event.status === 'done' ? '#2e7d32' : event.status === 'error' ? '#c62828' : '#0277bd',
            borderRadius: '3px',
            fontSize: '11px',
            fontWeight: '600'
          }}>
            {event.status}
          </div>
        </div>
      )}

      {/* Output */}
      {event.result && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', opacity: '0.8', marginBottom: '4px' }}>Output</div>
          <div style={{
            background: '#0b0f14',
            border: '1px solid #444c56',
            padding: '8px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#adbac7',
            overflow: 'auto',
            maxHeight: '150px'
          }}>
            {event.result}
          </div>
        </div>
      )}

      {/* Error */}
      {event.error && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#d32f2f', marginBottom: '4px' }}>Error</div>
          <div style={{
            background: '#0b0f14',
            border: '1px solid #d32f2f',
            padding: '8px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#ffcdd2',
            overflow: 'auto',
            maxHeight: '100px'
          }}>
            {event.error}
          </div>
        </div>
      )}

      {/* Approval Details */}
      {(event.type === 'DANGER_APPROVED' || event.type === 'DANGER_REJECTED') && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', opacity: '0.8', marginBottom: '4px' }}>Approval</div>
          {event.reason && (
            <div style={{ fontSize: '11px', color: '#adbac7', marginBottom: '4px' }}>
              <strong>Reason:</strong> {event.reason}
            </div>
          )}
          {event.severity && (
            <div style={{ fontSize: '11px', color: '#adbac7' }}>
              <strong>Severity:</strong> {event.severity}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * EventListItem Component
 * Single event in the event list
 */
function EventListItem({ event, index, isActive, onClick }) {
  const getEventLabel = (type) => {
    if (type === 'task:start') return '▶';
    if (type === 'task:done') return '✓';
    if (type === 'cmd:exec') return '🔧';
    if (type === 'DANGER_APPROVED') return '✓';
    if (type === 'DANGER_REJECTED') return '✗';
    if (type === 'cmd:error') return '✗';
    return '◆';
  };

  const getEventColor = (type) => {
    if (type === 'task:start') return '#1976d2';
    if (type === 'task:done') return '#2e7d32';
    if (type === 'cmd:exec') return '#f57c00';
    if (type === 'DANGER_APPROVED') return '#2e7d32';
    if (type === 'DANGER_REJECTED') return '#c62828';
    if (type === 'cmd:error') return '#d32f2f';
    return '#666';
  };

  return (
    <div
      onClick={onClick}
      style={{
        padding: '6px 8px',
        background: isActive ? '#2d333b' : 'transparent',
        border: `1px solid ${isActive ? '#444c56' : 'transparent'}`,
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '11px',
        color: '#adbac7',
        transition: 'all 0.2s'
      }}
    >
      <span style={{ color: getEventColor(event.type), fontWeight: '600' }}>
        {getEventLabel(event.type)}
      </span>
      <span style={{ flex: 1 }}>
        {event.taskTitle || event.type}
        {event.command && ` - ${event.command.substring(0, 30)}...`}
      </span>
      <span style={{ opacity: '0.5', fontSize: '10px' }}>
        {new Date(event.ts).toLocaleTimeString()}
      </span>
    </div>
  );
}

export default { ReplayView };
